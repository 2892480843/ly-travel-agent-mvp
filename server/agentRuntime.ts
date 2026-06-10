import type { ServerResponse } from "node:http";
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
  type UIMessageStreamWriter
} from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { AgentMessageMetadata, AiRecommendationCard, AiResponse, MapPoint } from "../src/types";
import { createAgentTools, createCollectedArtifacts, type AgentDeps, type CollectedArtifacts } from "./agentTools";
import { confidenceFromTools, modelTextViolatesGuardrails, runTravelAgent } from "./travelAgent";
import { poiToCard } from "./travelAgent";
import * as store from "./conversationStore";
import { DEFAULT_TICKET_ROUTE } from "./config/city";

export type AgentStreamContext = {
  userId: string;
  conversationId?: string;
  newConversation?: boolean;
  /** Test seam: inject a mock LanguageModel instead of the DeepSeek provider. */
  model?: LanguageModel;
  abortSignal?: AbortSignal;
};

const TOTAL_BUDGET_MS = 75_000;

const SYSTEM_PROMPT = [
  "你是「江城知旅」的武汉文旅 AI 助手，用简体中文回答。",
  "你可以调用工具检索真实数据：POI 搜索、路线规划、天气、sandbox 票务候选、行程编排、同步地点到导览地图。",
  "核心纪律：",
  "1. 只把工具返回的内容当作事实；工具标注 fallback/估算时必须如实说明。",
  "2. 票务一律是 sandbox 演示候选——绝不宣称真实库存、支付成功或已出票。",
  "3. 天气工具 live=false 时，不得给出任何具体天气结论。",
  "4. 用户想“在地图上看 / 放到导览里”时调用 show_on_map；想要逐日安排时调用 generate_itinerary。",
  "5. 不要用相同参数重复调用同一工具；信息足够时立即作答。",
  "6. 回答控制在 300 字以内，给出可执行建议；多轮对话中记住此前上下文。",
  "7. 输出格式（重要）：使用简洁 Markdown——短段落 + 带**粗体小标题**的无序列表；禁止使用 #/## 大标题和 --- 分割线；表格最多 3 列且仅在确有必要时使用；每条建议最多一个 emoji。"
].join("\n");

export async function streamAgentChat(input: {
  text: string;
  ctx: AgentStreamContext;
  deps: AgentDeps;
  response: ServerResponse;
}) {
  const { text, ctx, deps, response } = input;
  const conversation = store.getOrCreateConversation(ctx.userId, ctx.conversationId, ctx.newConversation);
  const history = store.listModelHistory(conversation.id);
  store.appendUserMessage(conversation.id, text);

  const abortController = new AbortController();
  const budgetTimer = setTimeout(() => abortController.abort(), TOTAL_BUDGET_MS);
  ctx.abortSignal?.addEventListener("abort", () => abortController.abort(), { once: true });

  const model = ctx.model ?? resolveModelFromEnv();

  const stream = createUIMessageStream({
    onError: (error) => (error instanceof Error ? error.message : String(error)),
    execute: async ({ writer }) => {
      writer.write({ type: "data-meta", data: { conversationId: conversation.id }, transient: true });

      if (!model) {
        await writeDeterministicTurn(writer, text, deps, conversation.id, "服务端未配置 AI_PROVIDER/AI_API_KEY，本轮由 deterministic Agent 生成。");
        return;
      }

      const collected = createCollectedArtifacts();
      try {
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: [
            ...history.map((item) => ({ role: item.role, content: item.content } as const)),
            { role: "user" as const, content: text }
          ],
          tools: createAgentTools({ deps, writer, collected }),
          stopWhen: stepCountIs(6),
          abortSignal: abortController.signal,
          // DeepSeek-specific switch; unknown keys are ignored by other providers.
          providerOptions: { deepseek: { thinking: { type: "disabled" } } as never }
        });
        writer.merge(result.toUIMessageStream({ sendStart: true, sendFinish: true }));
        const finalText = (await result.text).trim();
        writer.write({
          type: "message-metadata",
          messageMetadata: buildAssistantMetadata(collected, finalText, conversation.id)
        });
      } catch (error) {
        // Whole-loop failure (model unreachable, abort, etc.) → deterministic fallback in-stream.
        const reason = error instanceof Error ? error.message : "unknown error";
        await writeDeterministicTurn(writer, text, deps, conversation.id, `Agent 循环失败已降级 deterministic：${reason}。`);
      }
    },
    onFinish: ({ responseMessage }) => {
      clearTimeout(budgetTimer);
      try {
        const metadata = (responseMessage.metadata ?? {}) as AgentMessageMetadata;
        const persistedText = metadata.sanitizedText
          ?? metadata.aiResponse?.text
          ?? extractText(responseMessage)
          ?? "";
        store.appendAssistantMessage(conversation.id, persistedText, JSON.stringify(responseMessage));
      } catch {
        // Persistence must never break the stream lifecycle.
      }
    }
  });

  pipeUIMessageStreamToResponse({ response, stream });
}

function resolveModelFromEnv(): LanguageModel | undefined {
  const provider = process.env.AI_PROVIDER ?? "fallback";
  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL;
  if (provider === "fallback" || !apiKey) return undefined;
  const deepseek = createDeepSeek({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return deepseek(process.env.AI_MODEL ?? "deepseek-chat");
}

/** Deterministic pipeline rendered as a normal streamed turn (no model configured / loop failed). */
async function writeDeterministicTurn(
  writer: UIMessageStreamWriter,
  text: string,
  deps: AgentDeps,
  conversationId: string,
  noteSuffix: string
) {
  const fallback = await runTravelAgent(text, { mapProvider: deps.mapProvider, getTicketOptions: deps.getTicketOptions });
  fallback.sourceNote = `${fallback.sourceNote} ${noteSuffix}`.trim();
  const textId = "deterministic-text";
  writer.write({ type: "text-start", id: textId });
  writer.write({ type: "text-delta", id: textId, delta: fallback.text });
  writer.write({ type: "text-end", id: textId });
  if (fallback.mapStops && fallback.mapStops.length >= 2) {
    writer.write({ type: "data-action", data: { type: "tour-intent", label: text, stops: fallback.mapStops }, transient: true });
  }
  const metadata: AgentMessageMetadata = { conversationId, aiResponse: fallback };
  writer.write({ type: "message-metadata", messageMetadata: metadata });
}

function buildAssistantMetadata(collected: CollectedArtifacts, finalText: string, conversationId: string): AgentMessageMetadata {
  const cards: AiRecommendationCard[] = collected.pois.slice(0, 2).map(poiToCard);
  if (collected.tickets) {
    cards.push({
      id: "agent-ticket-card",
      title: `${collected.tickets.poiName} 演示票务`,
      subtitle: `${collected.tickets.products.length} 类票 · ${collected.tickets.slots.length} 个时段 · sandbox 演示库存`,
      href: DEFAULT_TICKET_ROUTE,
      actionLabel: "去预约"
    });
  }
  if (collected.itinerary) {
    cards.push({
      id: "agent-itinerary-card",
      title: collected.itinerary.title,
      subtitle: `${collected.itinerary.days} 天 · ${collected.itinerary.items.length} 个日程节点 · 已同步行程页`,
      href: "/plan",
      actionLabel: "查看完整行程"
    });
  }

  const mapStops: MapPoint[] | undefined = collected.explicitMapStops
    ?? collected.itinerary?.mapStops
    ?? (collected.pois.length >= 2
      ? collected.pois.slice(0, 5).map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }))
      : undefined);

  const providers = new Set<string>();
  if (collected.pois.length || collected.route || collected.weather) providers.add("amap");
  const model = process.env.AI_MODEL ?? "deepseek-chat";
  const sourceNote = [
    `服务端 Agent v2；工具 provider：${providers.size ? [...providers].join("/") : "local"}；坐标系 GCJ-02。`,
    "票价、库存、开放时间、天气、交通状态以官方渠道为准；未声明支付、锁票或核销完成。",
    `回答由 deepseek/${model} 经多轮工具调用流式生成。`
  ].join(" ");

  const evidence: AiResponse = {
    text: deterministicSummaryFrom(collected),
    cards: [],
    toolCalls: collected.uiToolCalls,
    confidence: 0,
    sourceNote: ""
  };
  const violated = modelTextViolatesGuardrails(finalText, evidence);

  const aiResponse: AiResponse = {
    text: violated ? evidence.text : finalText,
    cards,
    toolCalls: collected.uiToolCalls,
    confidence: confidenceFromTools(collected.uiToolCalls.length ? collected.uiToolCalls : [{ name: "对话", status: "success", summary: "未调用工具" }]),
    sourceNote: violated
      ? `${sourceNote} 模型输出未通过安全校验（疑似虚构支付/库存/天气结论），已替换为工具事实摘要。`
      : sourceNote,
    mapStops
  };

  return {
    conversationId,
    aiResponse,
    ...(violated ? { sanitizedText: evidence.text } : {})
  };
}

/** Honest tool-fact summary used when guardrails reject the streamed text. */
function deterministicSummaryFrom(collected: CollectedArtifacts): string {
  const lines: string[] = [];
  if (collected.pois.length) {
    lines.push(`候选地点：${collected.pois.slice(0, 4).map((poi) => poi.name).join("、")}。`);
  }
  if (collected.route) {
    lines.push(`路线：${collected.route.mode} 约 ${(collected.route.distanceMeters / 1000).toFixed(1)} 公里、${collected.route.durationMinutes} 分钟${collected.route.fallback ? "（估算）" : ""}。`);
  }
  if (collected.tickets) {
    lines.push(`${collected.tickets.poiName}有 ${collected.tickets.products.length} 类 sandbox 演示票（非真实库存）。`);
  }
  if (collected.itinerary) {
    lines.push(`已生成行程「${collected.itinerary.title}」，可在行程规划页查看。`);
  }
  if (!lines.length) {
    lines.push("请补充目的地、同行人群或时间，我再帮你检索与规划。");
  }
  return lines.join("\n");
}

function extractText(message: UIMessage): string | undefined {
  const parts = (message.parts ?? []) as Array<{ type?: string; text?: string }>;
  const text = parts.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join("");
  return text || undefined;
}
