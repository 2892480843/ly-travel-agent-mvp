import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Camera,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Mic,
  Navigation,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AgentMessageMetadata, AiResponse, MapPoint, MetricItem, Poi, RouteResult, ScenicSpot, StatusTone, TimelineItem, WorkflowNode } from "../types";
import { channelData, spotImages, trafficData, workflowNodes } from "../data/mockData";
import { DEFAULT_CITY_CENTER, DEFAULT_CITY_NAME, DEFAULT_TICKET_POI_NAME, DEFAULT_TICKET_ROUTE } from "../config/city";
import { askTravelAssistant } from "../services/aiService";
import { apiUrl, createConversation, fetchLatestConversation } from "../services/apiClient";
import { saveTourIntent } from "../services/tourIntentService";
import { triggerOperation } from "../services/operationService";
import { todayISO } from "../utils/demoDates";
import { flatMeters, orderOpenTour } from "../utils/tour";
import { IS_LIVE } from "../config/appEnv";

export function StatusTag({ children, tone = "blue" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function PageLoader({ label = "正在加载智慧文旅服务" }: { label?: string }) {
  return (
    <div className="container page-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="loader-hero">
        <span className="loader-mark" />
        <div>
          <strong>{label}</strong>
          <p className="muted">正在同步页面资源、票务状态与地图组件...</p>
        </div>
      </div>
      <div className="skeleton-grid">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </div>
  );
}

/**
 * Marks hardcoded showcase content. Renders nothing in demo mode; in live
 * deployments it labels the content so it cannot pass as production data.
 */
export function DemoDataBadge({ label = "演示数据" }: { label?: string }) {
  if (!IS_LIVE) return null;
  return <span className="demo-data-badge">{label}</span>;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="dashboard-title page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="filters page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-panel ${className}`}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="section-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ metric }: { metric: MetricItem }) {
  const Icon = metric.icon ?? Star;
  const negative = metric.delta.includes("-");
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article className={`card metric metric-${metric.tone}`} whileHover={shouldReduceMotion ? undefined : { y: -4 }}>
      <div className="metric-icon">
        <Icon size={22} />
      </div>
      <div>
        <span className="muted">{metric.label}</span>
        <b>{metric.value}</b>
        <small className={negative ? "trend-good" : "trend-hot"}>{metric.delta}</small>
      </div>
    </motion.article>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className = ""
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-pad chart-card ${className}`.trim()}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SpotCard({ spot, compact = false }: { spot: ScenicSpot; compact?: boolean }) {
  const crowdTone: StatusTone = spot.crowd === "舒适" || spot.crowd === "较少" ? "green" : spot.crowd === "适中" ? "orange" : "red";
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article className={`card spot-card ${compact ? "compact" : ""}`} whileHover={shouldReduceMotion ? undefined : { y: -4 }}>
      <img src={spot.image} alt={spot.name} />
      <div className="spot-body">
        <div className="spot-head">
          <h3>{spot.name}</h3>
          <span className="rating">★ {spot.rating}</span>
        </div>
        <div className="filters tiny-gap">
          <StatusTag tone={crowdTone}>{spot.crowd}</StatusTag>
          {spot.price ? <StatusTag tone="orange">￥{spot.price}</StatusTag> : <StatusTag tone="green">免费</StatusTag>}
          {spot.tags.slice(0, 2).map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}
        </div>
        <p className="reason"><span className="reason-label">为什么推荐你：</span>{spot.reason}</p>
        {!compact ? (
          <div className="card-meta-row">
            <span><MapPin size={14} /> {spot.location}</span>
            <span><Clock3 size={14} /> {spot.duration}</span>
            <span>{spot.weather}</span>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="timeline">
      {items.map((item) => (
        <div className="timeline-item" key={`${item.time}-${item.title}`}>
          <strong>{item.time}</strong>
          <motion.div className="card itinerary-card" whileHover={shouldReduceMotion ? undefined : { x: 3 }}>
            {item.image ? <img src={item.image} className="thumb" alt={item.title} /> : <div className="thumb placeholder"><Navigation size={24} /></div>}
            <div className="itinerary-card-body">
              <div className="itinerary-card-head">
                <h3>{item.title}</h3>
                <StatusTag tone={item.type === "food" ? "orange" : item.type === "traffic" ? "green" : "blue"}>{item.meta}</StatusTag>
              </div>
              <p className="muted">{item.subtitle}</p>
              <div className="filters tiny-gap">
                {item.tags.map((tag) => <StatusTag key={tag} tone={item.type === "food" ? "orange" : "slate"}>{tag}</StatusTag>)}
                {item.open ? <StatusTag tone="blue">开放 {item.open}</StatusTag> : null}
                {item.traffic ? <StatusTag tone="green">{item.traffic}</StatusTag> : null}
              </div>
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export type AIChatPromptRequest = {
  id: number;
  text: string;
  autoSubmit?: boolean;
};

type AgentUIMessage = UIMessage<AgentMessageMetadata>;

const TOOL_PART_LABELS: Record<string, string> = {
  search_pois: "POI 搜索",
  plan_route: "路线规划",
  get_weather: "天气查询",
  get_ticket_options: "票务候选",
  generate_itinerary: "行程编排",
  show_on_map: "同步到导览地图"
};

const SEED_MESSAGES: AgentUIMessage[] = [
  { id: "seed-u1", role: "user", parts: [{ type: "text", text: "武汉一日游，有哪些必去景点和美食推荐？" }] },
  {
    id: "seed-a1",
    role: "assistant",
    parts: [{ type: "text", text: "为你生成经典轻松路线：黄鹤楼 → 黄鹤楼公园 → 江汉关博物馆 → 汉口江滩。当前客流为演示估算，建议上午登楼、下午江滩慢游。" }],
    metadata: {
      aiResponse: {
        text: "为你生成经典轻松路线：黄鹤楼 → 黄鹤楼公园 → 江汉关博物馆 → 汉口江滩。当前客流为演示估算，建议上午登楼、下午江滩慢游。",
        cards: [],
        toolCalls: [
          { name: "POI 搜索", status: "success", summary: "命中武汉真实 POI 候选" },
          { name: "路线提示", status: "success", summary: "已按轻松游约束生成" }
        ],
        confidence: 0.78,
        sourceNote: "演示初始消息；票务、价格、开放时间以官方接口为准。"
      }
    }
  },
  { id: "seed-u2", role: "user", parts: [{ type: "text", text: "帮我把黄鹤楼加入预约，并避开排队高峰。" }] },
  {
    id: "seed-a2",
    role: "assistant",
    parts: [{ type: "text", text: "已为你选择 08:00-10:00 sandbox 候选时段，成人票 2 张。请进入订单确认页核对游客信息；本系统当前只做演示支付。" }],
    metadata: {
      aiResponse: {
        text: "已为你选择 08:00-10:00 sandbox 候选时段，成人票 2 张。请进入订单确认页核对游客信息；本系统当前只做演示支付。",
        cards: [{ id: "ticket-yellow-crane-tower", title: "黄鹤楼上午票", subtitle: "08:00-10:00 · sandbox 演示库存", href: DEFAULT_TICKET_ROUTE, actionLabel: "去确认" }],
        toolCalls: [{ name: "票务库存查询", status: "success", summary: "返回演示库存，真实库存以官方接口为准" }],
        confidence: 0.81,
        sourceNote: "当前为演示票务候选，不代表真实锁票。"
      }
    }
  }
];

function messageText(message: AgentUIMessage): string {
  const streamed = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof (part as { text?: unknown }).text === "string")
    .map((part) => part.text)
    .join("");
  return message.metadata?.sanitizedText ?? (streamed || message.metadata?.aiResponse?.text || "");
}

/** Assistant bubbles render model markdown (GFM tables/lists/bold) instead of raw text. */
function MarkdownText({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className={`chat-markdown ${streaming ? "is-streaming" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function toolPartsOf(message: AgentUIMessage) {
  return message.parts
    .filter((part) => typeof part.type === "string" && part.type.startsWith("tool-"))
    .map((part) => {
      const toolPart = part as { type: string; toolCallId: string; state: string; errorText?: string };
      const toolName = toolPart.type.replace(/^tool-/, "");
      return {
        key: toolPart.toolCallId,
        label: TOOL_PART_LABELS[toolName] ?? toolName,
        state: toolPart.state,
        errorText: toolPart.errorText
      };
    });
}

export function AIChat({
  onResult,
  promptRequest,
  onPromptRequestConsumed
}: {
  onResult?: (result: AiResponse, prompt: string) => void;
  promptRequest?: AIChatPromptRequest;
  onPromptRequestConsumed?: () => void;
} = {}) {
  const shouldReduceMotion = useReducedMotion();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const conversationIdRef = useRef<string | undefined>(undefined);
  const lastPromptRef = useRef("");
  const [historyReady, setHistoryReady] = useState(false);

  const transport = useMemo(() => new DefaultChatTransport<AgentUIMessage>({
    api: apiUrl("/api/agent/chat/stream"),
    credentials: "include",
    prepareSendMessagesRequest: ({ messages: outgoing }) => {
      const lastUser = [...outgoing].reverse().find((message) => message.role === "user");
      const text = lastUser ? messageText(lastUser as AgentUIMessage) : "";
      return { body: { input: text, conversationId: conversationIdRef.current } };
    }
  }), []);

  const { messages, setMessages, sendMessage, status } = useChat<AgentUIMessage>({
    transport,
    messages: SEED_MESSAGES,
    onData: (dataPart) => {
      if (dataPart.type === "data-meta") {
        const meta = dataPart.data as { conversationId?: string };
        if (meta?.conversationId) conversationIdRef.current = meta.conversationId;
      }
      if (dataPart.type === "data-action") {
        const action = dataPart.data as { type?: string; label?: string; stops?: MapPoint[] };
        if (action?.type === "tour-intent" && action.stops && action.stops.length >= 2) {
          saveTourIntent({ source: "assistant", label: action.label ?? lastPromptRef.current, stops: action.stops });
          window.dispatchEvent(new CustomEvent("ly:operation-result", {
            detail: { status: "completed", message: `已将 ${action.stops.length} 个地点同步到智能导览页` }
          }));
        }
      }
    },
    onFinish: ({ message }) => {
      const aiResponse = message.metadata?.aiResponse;
      if (aiResponse) onResult?.(aiResponse, lastPromptRef.current || "对话");
    },
    onError: () => {
      // Degrade: legacy JSON route → local deterministic fallback (handled inside askTravelAssistant).
      const prompt = lastPromptRef.current;
      if (!prompt) return;
      void askTravelAssistant(prompt).then((result) => {
        setMessages((current) => [...current, {
          id: `fallback-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text: result.text }],
          metadata: { aiResponse: result }
        } as AgentUIMessage]);
        onResult?.(result, prompt);
      });
    }
  });

  const busy = status === "submitted" || status === "streaming";

  // Restore the latest persisted conversation; keep demo seeds when empty.
  useEffect(() => {
    let alive = true;
    fetchLatestConversation().then(({ conversationId, messages: stored }) => {
      if (!alive) return;
      if (conversationId) conversationIdRef.current = conversationId;
      if (stored.length) {
        setMessages(stored as unknown as AgentUIMessage[]);
      }
      setHistoryReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publish the latest assistant state once for the surrounding page chrome.
  useEffect(() => {
    if (!historyReady) return;
    const latest = [...messages].reverse().find((message) => message.role === "assistant" && message.metadata?.aiResponse);
    if (latest?.metadata?.aiResponse) onResult?.(latest.metadata.aiResponse, "initial-demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyReady]);

  const submit = (value = input) => {
    const clean = value.trim();
    if (!clean || busy) return;
    lastPromptRef.current = clean;
    setInput("");
    void sendMessage({ text: clean });
  };

  const startNewConversation = async () => {
    const { conversationId } = await createConversation();
    if (conversationId) conversationIdRef.current = conversationId;
    setMessages([{
      id: `greet-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text: "新对话已开启。告诉我目的地、同行人和时间，我来帮你检索、规划并同步到地图与行程页。" }]
    } as AgentUIMessage]);
    triggerOperation({ scope: "visitor", type: "assistant.new_conversation", label: "新对话" });
  };

  const speech = useSpeechInput({
    onInterim: (text) => setInput(text),
    onFinal: (text) => {
      setInput(text);
      submit(text);
    }
  });

  const activatePhotoDemo = () => {
    const result: AiResponse = {
      text: "已识别示例图片为黄鹤楼相关场景，可继续询问票务、路线或讲解内容。",
      cards: [{ id: "vision-demo-yellow-crane", title: "黄鹤楼识别结果", subtitle: "拍照识别为演示能力，未上传真实图片", href: "/spot/yellow-crane-tower", actionLabel: "查看详情" }],
      toolCalls: [{ name: "拍照识别", status: "success", summary: "返回本地演示识别结果" }],
      confidence: 0.72,
      sourceNote: "当前仅使用本地示例识别说明，不代表真实图像识别或第三方视觉服务结果。"
    };
    onResult?.(result, "拍照识别");
    setMessages((current) => [...current, {
      id: `vision-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text: result.text }],
      metadata: { aiResponse: result }
    } as AgentUIMessage]);
    triggerOperation({ scope: "visitor", type: "vision.demo", label: "拍照识别" });
  };

  useEffect(() => {
    if (!promptRequest) return;
    setInput(promptRequest.text);
    if (promptRequest.autoSubmit) {
      submit(promptRequest.text);
    }
    onPromptRequestConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptRequest?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: shouldReduceMotion ? "auto" : "smooth" });
  }, [messages, status, shouldReduceMotion]);

  return (
    <div className="card card-pad chat-shell">
      <div className="chat-shell-head">
        <span className="muted">多轮对话 · 工具调用实时可见</span>
        <button className="ghost-btn" type="button" onClick={() => void startNewConversation()} disabled={busy}>
          <Plus size={15} /> 新对话
        </button>
      </div>
      <div className="chat" ref={chatRef} aria-label="AI 对话记录">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const aiResponse = message.metadata?.aiResponse;
          const liveTools = toolPartsOf(message);
          const finishedToolCalls = aiResponse?.toolCalls ?? [];
          const isStreamingThis = !isUser && status === "streaming" && index === messages.length - 1 && !aiResponse;
          return (
            <motion.div
              className={`bubble ${isUser ? "user" : "ai"}`}
              key={message.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            >
              {!isUser ? (
                <div className="chat-message-head">
                  <span className="chat-avatar"><Bot size={16} /></span>
                  <div>
                    <strong>AI助手</strong>
                    <small>{isStreamingThis ? "回复中" : "Agent v2"}</small>
                  </div>
                </div>
              ) : null}
              {isUser
                ? <p className="chat-message-text">{messageText(message)}</p>
                : <MarkdownText text={messageText(message)} streaming={isStreamingThis} />}
              {!isUser ? (
                <>
                  {(liveTools.length || finishedToolCalls.length) ? (
                    <div className="tool-row chat-tool-row">
                      {(aiResponse ? finishedToolCalls : []).map((tool, toolIndex) => (
                        <span className={`tool-call ${tool.status}`} key={`${tool.name}-${toolIndex}`}>
                          {tool.status === "success" ? <CheckCircle2 size={14} /> : tool.status === "failed" ? <X size={14} /> : <Loader2 size={14} />}
                          {tool.name}：{tool.summary}
                        </span>
                      ))}
                      {!aiResponse ? liveTools.map((tool) => (
                        <span className={`tool-call ${tool.state === "output-error" ? "failed" : tool.state === "output-available" ? "success" : "running"}`} key={tool.key}>
                          {tool.state === "output-available" ? <CheckCircle2 size={14} /> : tool.state === "output-error" ? <X size={14} /> : <Loader2 size={14} className="spin" />}
                          {tool.label}{tool.state === "output-error" ? `：${tool.errorText ?? "失败"}` : tool.state === "output-available" ? "：完成" : "：调用中…"}
                        </span>
                      )) : null}
                    </div>
                  ) : null}
                  {aiResponse?.cards.length ? (
                    <div className="chat-result-grid">
                      {aiResponse.cards.map((card) => (
                        <a className="chat-result-card" href={card.href ?? "#"} key={card.id}>
                          {card.image ? <img src={card.image} alt={card.title} /> : (
                            <span className="chat-result-icon"><CalendarCheck size={24} /></span>
                          )}
                          <span className="chat-result-copy">
                            <strong>{card.title}</strong>
                            <p className="muted">{card.subtitle}</p>
                          </span>
                          {card.actionLabel ? <span className="chat-result-action">{card.actionLabel}<ChevronRight size={15} /></span> : null}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {aiResponse ? (
                    <div className="chat-source-note">
                      <span className="chat-confidence">
                        <small>置信度</small>
                        <strong>{(aiResponse.confidence * 100).toFixed(0)}%</strong>
                      </span>
                      <div className="chat-source-copy">
                        <ShieldCheck size={14} />
                        <p>{aiResponse.sourceNote}</p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </motion.div>
          );
        })}
        {status === "submitted" ? (
          <motion.div className="bubble ai is-loading" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}>
            <div className="chat-message-head">
              <span className="chat-avatar"><Bot size={16} /></span>
              <div>
                <strong>AI助手</strong>
                <small>思考中</small>
              </div>
            </div>
            <p><Loader2 size={14} className="spin" /> 正在理解问题并选择工具...</p>
          </motion.div>
        ) : null}
      </div>
      <div className="search-pill compact-input chat-composer">
        <span className="chat-composer-icon"><Bot size={18} /></span>
        <textarea
          aria-label="输入旅行助手问题"
          placeholder={speech.recording ? "正在聆听，请说话…" : "请输入你的问题..."}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="chat-composer-tools" aria-label="输入辅助">
          <button
            className={`chat-tool-btn ${speech.recording ? "is-recording" : ""}`}
            type="button"
            aria-label={speech.recording ? "停止语音输入" : "语音输入"}
            onClick={speech.toggle}
          >
            <Mic size={17} />
          </button>
          <button className="chat-tool-btn" type="button" aria-label="拍照识别" onClick={activatePhotoDemo}><Camera size={17} /></button>
        </div>
        <button className="icon-btn" aria-label="发送问题" disabled={busy || !input.trim()} onClick={() => submit()}><Send size={18} /></button>
      </div>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Browser-native zh-CN speech-to-text; gracefully degrades when unsupported. */
function useSpeechInput({ onInterim, onFinal }: { onInterim: (text: string) => void; onFinal: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const toggle = () => {
    if (recording) {
      stop();
      return;
    }
    const win = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) {
      window.dispatchEvent(new CustomEvent("ly:operation-result", {
        detail: { status: "failed", message: "当前浏览器不支持语音识别，请使用 Chrome / Edge" }
      }));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) onFinal(final.trim());
      else if (interim) onInterim(interim.trim());
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    triggerOperation({ scope: "visitor", type: "voice.input", label: "语音输入" });
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { recording, toggle, stop };
}

export function TrafficChart({ type = "line" }: { type?: "line" | "area" | "bar"; }) {
  const chartProps = { data: trafficData, margin: { top: 12, right: 18, left: 8, bottom: 8 } };
  const tooltipStyle = { borderRadius: 8, border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" };
  const axisTick = { fill: "var(--muted)", fontSize: 12, fontWeight: 800 };
  return (
    <ResponsiveContainer width="100%" height={250}>
      {type === "bar" ? (
        <BarChart {...chartProps} barCategoryGap="24%" barGap={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="today" name="今日客流" fill="#7ba7c8" maxBarSize={24} radius={[8, 8, 0, 0]} />
          <Bar dataKey="ai" name="AI触达" fill="#83b8ad" maxBarSize={24} radius={[8, 8, 0, 0]} />
        </BarChart>
      ) : type === "area" ? (
        <AreaChart {...chartProps}>
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ba7c8" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#7ba7c8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey="today" name="今日客流" stroke="#7ba7c8" fill="url(#trafficFill)" strokeWidth={3} />
        </AreaChart>
      ) : (
        <LineChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="today" name="今日" stroke="#7ba7c8" strokeWidth={3} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="yesterday" name="昨日" stroke="#cbd6cf" strokeWidth={3} dot={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function FunnelPanel() {
  const totalValue = channelData[0]?.value ?? 0;
  const rows = channelData.map((entry, index) => {
    const previousValue = channelData[index - 1]?.value;
    const stepRateValue = previousValue ? (entry.value / previousValue) * 100 : 100;
    const retentionRateValue = totalValue ? (entry.value / totalValue) * 100 : 0;
    const dropRateValue = previousValue ? 100 - stepRateValue : 0;
    return {
      ...entry,
      index,
      conversionRate: `${stepRateValue.toFixed(2)}%`,
      dropRate: `${Math.max(dropRateValue, 0).toFixed(2)}%`,
      retentionRate: `${retentionRateValue.toFixed(2)}%`,
      retentionWidth: `${Math.max(retentionRateValue, 3).toFixed(2)}%`
    };
  });
  const lastRow = rows.at(-1);
  const finalRate = lastRow?.retentionRate ?? "0.00%";

  return (
    <div className="funnel-panel conversion-funnel-panel">
      <div className="conversion-funnel-summary" aria-label="预约到游览转化总览">
        <span>最终转化率</span>
        <strong>{finalRate}</strong>
        <small>
          {totalValue.toLocaleString()} 访问中，{(lastRow?.value ?? 0).toLocaleString()} 完成二次消费
        </small>
      </div>
      <div className="conversion-funnel-steps" aria-label="转化步骤明细">
        {rows.map((entry) => (
          <article
            className="conversion-funnel-step"
            key={entry.name}
            style={{ "--fill": entry.fill, "--bar": entry.retentionWidth } as CSSProperties}
          >
            <div className="conversion-step-head">
              <span className="conversion-funnel-index">{String(entry.index + 1).padStart(2, "0")}</span>
              <span className="conversion-funnel-copy">
                <strong>{entry.name}</strong>
                <small>总量留存 {entry.retentionRate}</small>
              </span>
              <b>{entry.value.toLocaleString()}</b>
            </div>
            <div className="conversion-step-track" aria-hidden="true">
              <span />
            </div>
            <div className="conversion-step-foot">
              <span>{entry.index === 0 ? "总访问基数" : `较上一步 ${entry.conversionRate}`}</span>
              <em>{entry.index === 0 ? "起点阶段" : `流失 ${entry.dropRate}`}</em>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function Donut({ data, height = 190 }: { data: Array<{ name: string; value: number; fill: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={4}>
          {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--line)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type AMapOverlay = unknown;

type AMapInstance = {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void;
  addControl: (control: unknown) => void;
  clearMap: () => void;
  destroy: () => void;
  getAllOverlays?: (type?: string) => AMapOverlay[];
  remove: (overlay: AMapOverlay | AMapOverlay[]) => void;
  setFitView: (overlays?: AMapOverlay[]) => void;
};

type AMapLngLat = { lng?: number; lat?: number; getLng?: () => number; getLat?: () => number };

type AMapWalkingResult = { routes?: Array<{ steps?: Array<{ path?: AMapLngLat[] }> }> };

type AMapWalking = {
  // The SDK passes an error string instead of a result object when status is "error".
  search: (from: [number, number], to: [number, number], callback: (status: string, result: AMapWalkingResult | string) => void) => void;
};

type AMapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapOverlay;
  Pixel: new (x: number, y: number) => unknown;
  Polyline: new (options: Record<string, unknown>) => AMapOverlay;
  Scale: new () => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  Walking?: new (options?: Record<string, unknown>) => AMapWalking;
};

type AMapLoaderGlobal = {
  load: (options: { key: string; version: string; plugins?: string[] }) => Promise<AMapNamespace>;
};

type AMapWindow = Window & {
  AMapLoader?: AMapLoaderGlobal;
  _AMapSecurityConfig?: {
    securityJsCode?: string;
    serviceHost?: string;
  };
};

let amapLoaderPromise: Promise<AMapLoaderGlobal> | undefined;

export function MapPanel({
  compact = false,
  scenic = false,
  pois = [],
  route
}: {
  compact?: boolean;
  scenic?: boolean;
  pois?: Poi[];
  route?: RouteResult;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapInstance | null>(null);
  const controlsAddedRef = useRef(false);
  const [mapState, setMapState] = useState<"fallback" | "loading" | "ready">("fallback");
  const staticPins = [
    ["黄鹤楼", 52, 54, "blue"],
    ["江汉关", 68, 38, "cyan"],
    ["汉口江滩", 74, 30, "blue"],
    ["湖北省博物馆", 38, 42, "green"],
    ["武汉动物园", 24, 70, "orange"],
    ["保成路夜市", 60, 72, "red"]
  ];
  const amapKey = import.meta.env.VITE_AMAP_JS_KEY?.trim() ?? "";
  const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() ?? "";
  const amapServiceHost = import.meta.env.VITE_AMAP_SERVICE_HOST?.trim() ?? "";
  const points = useMemo(() => mapMarkerPoints(route, pois), [pois, route]);
  const overlayKey = useMemo(() => points.map((point) => `${point.lng},${point.lat},${point.name ?? ""}`).join("|"), [points]);
  const routePathKey = useMemo(() => (route?.points ?? []).map((point) => `${point.lng},${point.lat}`).join("|"), [route?.points]);
  const center = points[0] ?? route?.points[0] ?? { ...DEFAULT_CITY_CENTER, name: DEFAULT_CITY_NAME };
  useEffect(() => {
    if (!amapKey || !containerRef.current) {
      setMapState("fallback");
      return;
    }

    let cancelled = false;
    const win = window as AMapWindow;
    const securityConfig = {
      ...(win._AMapSecurityConfig ?? {})
    };
    if (amapSecurityCode) securityConfig.securityJsCode = amapSecurityCode;
    if (amapServiceHost) securityConfig.serviceHost = amapServiceHost;
    if (Object.keys(securityConfig).length > 0) win._AMapSecurityConfig = securityConfig;

    setMapState((current) => current === "ready" ? current : "loading");

    loadAmapLoader()
      .then((loader) => loader.load({
        key: amapKey,
        version: "2.0",
        plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Walking"]
      }))
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new AMap.Map(containerRef.current, {
            center: [center.lng, center.lat],
            zoom: compact ? 13 : 12,
            viewMode: "2D"
          });
          if (import.meta.env.DEV) {
            (window as AMapWindow & { __amapDebug?: { map: AMapInstance } }).__amapDebug = { map: mapRef.current };
          }
        }
        if (!controlsAddedRef.current) {
          mapRef.current.addControl(new AMap.Scale());
          if (!compact) mapRef.current.addControl(new AMap.ToolBar({ position: "RB" }));
          controlsAddedRef.current = true;
        }
        renderAmapOverlays(AMap, mapRef.current, points, route?.points ?? [], () => cancelled);
        setMapState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setMapState("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [amapKey, amapSecurityCode, amapServiceHost, center.lat, center.lng, compact, overlayKey, points, route?.points, routePathKey]);

  useEffect(() => {
    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
      controlsAddedRef.current = false;
    };
  }, []);

  const fallbackVisible = mapState !== "ready";

  return (
    <div className={`card map-panel ${compact ? "compact" : ""} ${scenic ? "scenic" : ""} ${mapState === "ready" ? "amap-ready" : ""}`}>
      <div ref={containerRef} className="amap-canvas" aria-label="高德地图" />
      {fallbackVisible ? (
        <div className="map-fallback" aria-hidden={mapState === "loading"}>
          <div className="map-line" />
          <div className="map-water" />
          {staticPins.map(([name, x, y, tone], index) => (
            <span
              className={`pin ${tone}`}
              key={name as string}
              style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}
            >
              {index + 1} {name}
            </span>
          ))}
        </div>
      ) : null}
      <span className={`map-status ${mapState === "ready" ? "ready" : ""}`}>
        {mapState === "loading" ? "高德地图加载中" : mapState === "ready" ? "高德地图" : "本地底图"}
      </span>
    </div>
  );
}

function loadAmapLoader(): Promise<AMapLoaderGlobal> {
  const win = window as AMapWindow;
  if (win.AMapLoader) return Promise.resolve(win.AMapLoader);
  if (amapLoaderPromise) return amapLoaderPromise;

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-amap-loader='true']");
    if (existing) {
      existing.addEventListener("load", () => win.AMapLoader ? resolve(win.AMapLoader) : reject(new Error("AMapLoader is not available")));
      existing.addEventListener("error", () => reject(new Error("AMap loader script failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://webapi.amap.com/loader.js";
    script.async = true;
    script.dataset.amapLoader = "true";
    script.addEventListener("load", () => win.AMapLoader ? resolve(win.AMapLoader) : reject(new Error("AMapLoader is not available")));
    script.addEventListener("error", () => reject(new Error("AMap loader script failed")));
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

function mapMarkerPoints(route: RouteResult | undefined, pois: Poi[]): MapPoint[] {
  if (pois.length) return pois.map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }));
  const namedRoutePoints = route?.points.filter((point) => Boolean(point.name)) ?? [];
  if (namedRoutePoints.length) return namedRoutePoints;
  return [
    { name: "黄鹤楼", lng: 114.302409, lat: 30.544404 },
    { name: "江汉关博物馆", lng: 114.292416, lat: 30.57909 },
    { name: "汉口江滩-观江台", lng: 114.308085, lat: 30.601017 }
  ];
}

const WALKING_MIN_INTERVAL_MS = 400; // ~2.5 QPS, under the ~3 QPS cap of personal AMap keys
const WALKING_RETRY_LIMIT = 2;
const WALKING_RETRY_BACKOFF_MS = 800;
const WALKING_TIMEOUT_MS = 6000;
const CONNECTOR_GAP_METERS = 30;

type SegmentStatus = "pending" | "routed" | "unrouted";

type RouteSegment = { from: MapPoint; to: MapPoint; status: SegmentStatus; line?: AMapOverlay };

type WalkingOutcome =
  | { kind: "path"; path: MapPoint[] }
  | { kind: "no-route" }
  | { kind: "transient" }
  | { kind: "cancelled" };

function renderAmapOverlays(AMap: AMapNamespace, map: AMapInstance, points: MapPoint[], routePoints: MapPoint[], isCancelled: () => boolean = () => false) {
  map.clearMap();
  const overlays: AMapOverlay[] = [];
  const anchors = routePoints.length ? routePoints : orderOpenTour(points);
  // A dense path means the backend already returned a road-following
  // polyline; a sparse one is just stop-to-stop straight segments.
  const isDensePath = routePoints.length > points.length + 2;

  let segments: RouteSegment[] = [];
  if (anchors.length > 1 && isDensePath) {
    overlays.push(createRoadPolyline(AMap, anchors));
  } else if (anchors.length > 1) {
    // Sparse legs render as dashed schematic lines first (never fake curves),
    // then upgrade one by one to road-following paths.
    const canUpgrade = Boolean(AMap.Walking);
    segments = anchors.slice(1).map((to, index) => ({
      from: anchors[index],
      to,
      status: (canUpgrade ? "pending" : "unrouted") as SegmentStatus
    }));
    segments.forEach((segment) => {
      segment.line = createSchematicPolyline(AMap, segment.from, segment.to, segment.status === "pending" ? "pending" : "unrouted");
      overlays.push(segment.line);
    });
  }

  points.slice(0, 12).forEach((point, index) => {
    overlays.push(new AMap.Marker({
      position: [point.lng, point.lat],
      title: point.name ?? `点位 ${index + 1}`,
      offset: new AMap.Pixel(-18, -38),
      content: `<div class="amap-custom-pin"><span>${index + 1}</span>${escapeHtml(point.name ?? "点位")}</div>`
    }));
  });

  if (overlays.length) {
    map.add(overlays);
    map.setFitView(overlays);
  }

  if (segments.length && AMap.Walking) {
    void upgradeSegmentsProgressively(AMap, map, segments, isCancelled);
  }
}

// Swap each schematic leg for its road-following walking path as results
// arrive. The camera is never re-fitted here, and after every await the
// cancellation flag is re-checked so a superseded render can't draw onto a
// map the next effect run has already cleared.
async function upgradeSegmentsProgressively(AMap: AMapNamespace, map: AMapInstance, segments: RouteSegment[], isCancelled: () => boolean) {
  for (const segment of segments) {
    if (isCancelled()) return;
    const path = await requestWalkingSegment(AMap, segment.from, segment.to, isCancelled);
    if (isCancelled()) return;
    if (segment.line) map.remove(segment.line);
    if (path) {
      segment.status = "routed";
      segment.line = createRoadPolyline(AMap, path);
      map.add(segment.line);
      // POIs inside parks sit off the road network; bridge the gap between
      // the marker and where the walkable path actually starts/ends.
      if (metersBetween(segment.from, path[0]) > CONNECTOR_GAP_METERS) {
        map.add(createConnectorPolyline(AMap, segment.from, path[0]));
      }
      if (metersBetween(segment.to, path[path.length - 1]) > CONNECTOR_GAP_METERS) {
        map.add(createConnectorPolyline(AMap, segment.to, path[path.length - 1]));
      }
    } else {
      segment.status = "unrouted";
      segment.line = createSchematicPolyline(AMap, segment.from, segment.to, "unrouted");
      map.add(segment.line);
    }
  }
}

function createRoadPolyline(AMap: AMapNamespace, path: MapPoint[]): AMapOverlay {
  return new AMap.Polyline({
    path: path.map((point) => [point.lng, point.lat]),
    strokeColor: "#7ba7c8",
    strokeOpacity: 0.9,
    strokeWeight: 6,
    strokeStyle: "solid",
    lineJoin: "round",
    lineCap: "round",
    showDir: true,
    zIndex: 60
  });
}

function createSchematicPolyline(AMap: AMapNamespace, from: MapPoint, to: MapPoint, variant: "pending" | "unrouted"): AMapOverlay {
  return new AMap.Polyline({
    path: [[from.lng, from.lat], [to.lng, to.lat]],
    strokeColor: variant === "pending" ? "#7ba7c8" : "#9aa9b2",
    strokeOpacity: variant === "pending" ? 0.55 : 0.45,
    strokeWeight: 4,
    strokeStyle: "dashed",
    strokeDasharray: [8, 6],
    lineJoin: "round",
    lineCap: "round",
    showDir: false,
    zIndex: 50
  });
}

function createConnectorPolyline(AMap: AMapNamespace, from: MapPoint, to: MapPoint): AMapOverlay {
  return new AMap.Polyline({
    path: [[from.lng, from.lat], [to.lng, to.lat]],
    strokeColor: "#8a9aa6",
    strokeOpacity: 0.6,
    strokeWeight: 2,
    strokeStyle: "dashed",
    strokeDasharray: [4, 6],
    showDir: false,
    zIndex: 55
  });
}

const walkingSegmentCache = new Map<string, MapPoint[]>();
let walkingQueueTail: Promise<void> = Promise.resolve();
let lastWalkingRequestAt = 0;
let sharedWalking: AMapWalking | undefined;
let sharedWalkingOwner: AMapNamespace | undefined;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Serialize Walking requests (concurrency 1, >=400ms apart) so multi-leg
// routes — possibly from several mounted MapPanels — stay under the QPS cap.
function enqueueWalkingTask<T>(task: () => Promise<T>): Promise<T> {
  const run = walkingQueueTail.then(async () => {
    const wait = lastWalkingRequestAt + WALKING_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await delay(wait);
    lastWalkingRequestAt = Date.now();
    return task();
  });
  walkingQueueTail = run.then(() => undefined, () => undefined);
  return run;
}

function getSharedWalking(AMap: AMapNamespace): AMapWalking | undefined {
  if (!AMap.Walking) return undefined;
  if (!sharedWalking || sharedWalkingOwner !== AMap) {
    sharedWalking = new AMap.Walking({ hideMarkers: true, autoFitView: false });
    sharedWalkingOwner = AMap;
  }
  return sharedWalking;
}

function walkingCacheKey(from: MapPoint, to: MapPoint): string {
  return `${from.lng.toFixed(6)},${from.lat.toFixed(6)}|${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
}

async function requestWalkingSegment(AMap: AMapNamespace, from: MapPoint, to: MapPoint, isCancelled: () => boolean): Promise<MapPoint[] | undefined> {
  const key = walkingCacheKey(from, to);
  const cached = walkingSegmentCache.get(key);
  if (cached) return cached;
  for (let attempt = 0; attempt <= WALKING_RETRY_LIMIT; attempt += 1) {
    const outcome = await enqueueWalkingTask<WalkingOutcome>(() =>
      isCancelled() ? Promise.resolve({ kind: "cancelled" }) : searchWalkingOnce(AMap, from, to));
    if (outcome.kind === "path") {
      walkingSegmentCache.set(key, outcome.path);
      return outcome.path;
    }
    if (outcome.kind === "no-route" || outcome.kind === "cancelled") return undefined;
    if (attempt < WALKING_RETRY_LIMIT) await delay(WALKING_RETRY_BACKOFF_MS);
  }
  return undefined;
}

function searchWalkingOnce(AMap: AMapNamespace, from: MapPoint, to: MapPoint): Promise<WalkingOutcome> {
  const walking = getSharedWalking(AMap);
  if (!walking) return Promise.resolve({ kind: "no-route" });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: WalkingOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(outcome);
    };
    const timer = window.setTimeout(() => finish({ kind: "transient" }), WALKING_TIMEOUT_MS);
    walking.search([from.lng, from.lat], [to.lng, to.lat], (status, result) => {
      if (status === "complete" && typeof result !== "string") {
        const path: MapPoint[] = [];
        result.routes?.[0]?.steps?.forEach((step) => {
          step.path?.forEach((vertex) => {
            const lng = typeof vertex.getLng === "function" ? vertex.getLng() : vertex.lng;
            const lat = typeof vertex.getLat === "function" ? vertex.getLat() : vertex.lat;
            if (Number.isFinite(lng) && Number.isFinite(lat)) path.push({ lng: lng as number, lat: lat as number });
          });
        });
        return finish(path.length >= 2 ? { kind: "path", path } : { kind: "no-route" });
      }
      // "no_data" means no walkable route exists; anything else (QPS limit,
      // network error) is transient and worth retrying.
      if (status === "no_data") return finish({ kind: "no-route" });
      return finish({ kind: "transient" });
    });
  });
}

function metersBetween(a: MapPoint, b: MapPoint): number {
  return flatMeters(a, b);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}

export function OrderCard({ order }: { order: { id: string; title: string; status: string; amount: number; date: string; image?: string } }) {
  return (
    <article className="card order-card">
      <img src={order.image ?? spotImages.yellowCraneTower} alt={order.title} />
      <div className="order-card-main">
        <StatusTag tone={order.status === "待支付" ? "orange" : order.status === "已确认" ? "green" : "blue"}>{order.status}</StatusTag>
        <h3>{order.title}</h3>
        <p className="muted">{order.date}</p>
      </div>
      <div className="order-card-action">
        <b>￥{order.amount}</b>
        <a className="ghost-btn" href="/ticket/detail">查看凭证</a>
      </div>
    </article>
  );
}

export function TicketOption({
  title,
  desc,
  price,
  selected,
  onClick,
  stock
}: {
  title: string;
  desc: string;
  price: number;
  selected?: boolean;
  onClick?: () => void;
  stock?: string;
}) {
  return (
    <button className={`select-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{desc}</span>
      <b>{price === 0 ? "免费" : `￥${price}`}</b>
      {stock ? <small>{stock}</small> : null}
    </button>
  );
}

type VoucherPreviewProps = {
  title?: string;
  ticketName?: string;
  visitDate?: string;
  slotTime?: string;
  quantity?: number;
  amount?: number;
  gate?: string;
  holderNames?: string[];
  validUntil?: string;
};

export function VoucherPreview({
  title = `武汉文旅演示票务 · ${DEFAULT_TICKET_POI_NAME}`,
  ticketName = "成人票",
  visitDate = todayISO(),
  slotTime = "08:00-10:00",
  quantity = 2,
  amount,
  gate = "黄鹤楼景区西门",
  holderNames = ["张小文", "李小明"],
  validUntil
}: VoucherPreviewProps = {}) {
  const slotEnd = slotTime.includes("-") ? slotTime.split("-")[1] : "";
  const validityText = validUntil ?? (slotEnd ? `${slotEnd} 前有效` : "预约时段内有效");
  const visitors = Array.from({ length: quantity }, (_, index) => holderNames[index] ?? `第 ${index + 1} 位游客`);
  const details = [
    { label: "入园日期", value: visitDate },
    { label: "入园时段", value: slotTime },
    { label: "票数", value: `${quantity} 张` },
    { label: "核验入口", value: gate },
    { label: "有效期", value: validityText },
    ...(amount ? [{ label: "订单金额", value: `￥${amount}`, emphasis: true }] : [])
  ];

  return (
    <div className="voucher">
      <div className="voucher-qr">
        <QrCode size={104} />
        <span>动态核验码</span>
      </div>
      <div className="voucher-content">
        <div className="voucher-header">
          <StatusTag tone="green">入园凭证，仅供演示</StatusTag>
          <h3>{title} {ticketName}</h3>
          <p className="muted">仅用于 sandbox 流程演示，不代表真实出票、真实库存或官方支付凭证。</p>
        </div>
        <div className="voucher-detail-grid">
          {details.map((item) => (
            <div className={`voucher-detail-item ${item.emphasis ? "emphasis" : ""}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="voucher-visitors" aria-label="入园人">
          {visitors.map((visitor) => <span key={visitor}><ShieldCheck size={14} />{visitor}</span>)}
        </div>
        <div className="voucher-alert">
          <CheckCircle2 size={18} />
          <span>请在预约时段前往指定入口核验，建议提前 15 分钟到达并携带有效身份证件。</span>
        </div>
      </div>
    </div>
  );
}

export function RecommendReasonCard() {
  const reasons = [
    ["浏览与收藏记录", "你最近浏览了黄鹤楼、湖北省博物馆、江汉关博物馆等文化体验点。"],
    ["实时情境信息", "当前天气适合户外活动，武汉核心点位客流低于周末均值。"],
    ["智能算法匹配", "综合评分、距离、热度、库存与拥堵预测后生成排序。"]
  ];
  return (
    <Section title="为什么推荐给你" action={<Sparkles size={18} />}>
      <div className="grid">
        {reasons.map(([title, text], index) => (
          <div className="reason-row" key={title}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p className="muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ReviewTable({
  rows,
  columns,
  action = "查看",
  onAction,
  getRowKey,
  selectedRowKeys,
  onRowCheckedChange,
  onAllCheckedChange
}: {
  rows: string[][];
  columns: string[];
  action?: string;
  onAction?: (row: string[], index: number) => void;
  getRowKey?: (row: string[], index: number) => string;
  selectedRowKeys?: string[];
  onRowCheckedChange?: (row: string[], index: number, checked: boolean) => void;
  onAllCheckedChange?: (checked: boolean, rows: string[][]) => void;
}) {
  const controlledSelection = Array.isArray(selectedRowKeys);
  const rowKeyFor = (row: string[], index: number) => getRowKey?.(row, index) ?? `${row[0]}-${index}`;
  const allVisibleSelected = controlledSelection && rows.length > 0 && rows.every((row, index) => selectedRowKeys.includes(rowKeyFor(row, index)));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={controlledSelection ? allVisibleSelected : undefined}
                onChange={controlledSelection ? (event) => onAllCheckedChange?.(event.target.checked, rows) : undefined}
              />
            </th>
            {columns.map((column) => <th key={column}>{column}</th>)}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="muted">暂无匹配数据</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              <td>
                <input
                  type="checkbox"
                  checked={controlledSelection ? selectedRowKeys.includes(rowKeyFor(row, index)) : undefined}
                  defaultChecked={controlledSelection ? undefined : index === 0}
                  onChange={controlledSelection ? (event) => onRowCheckedChange?.(row, index, event.target.checked) : undefined}
                />
              </td>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>
                  {cellIndex === row.length - 1 && ["已通过", "已发布", "营业中"].some((value) => cell.includes(value)) ? <StatusTag tone="green">{cell}</StatusTag> :
                    cell.includes("待") || cell.includes("紧张") || cell.includes("失败") ? <StatusTag tone="orange">{cell}</StatusTag> :
                      cell.includes("驳回") || cell.includes("异常") ? <StatusTag tone="red">{cell}</StatusTag> : cell}
                </td>
              ))}
              <td><button className="ghost-btn" onClick={() => onAction?.(row, index)}>{action}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkflowNodeCard({
  node,
  active,
  onClick
}: {
  node: WorkflowNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`workflow-node ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ left: `${node.x}%`, top: `${node.y}%` } as CSSProperties}
    >
      <StatusTag tone={node.tone}>{node.type}</StatusTag>
      <h3>{node.title}</h3>
      <p>{node.sla}</p>
    </button>
  );
}

export function WorkflowCanvas({ selected, onSelect }: { selected: WorkflowNode; onSelect: (node: WorkflowNode) => void }) {
  return (
    <div className="card workflow-canvas">
      <svg className="workflow-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 12 L50 22 L22 44 M50 22 L50 44 M50 22 L78 44 M22 44 L50 64 M50 44 L50 64 M78 44 L50 64 M50 64 L50 82" />
      </svg>
      {workflowNodes.map((node) => (
        <WorkflowNodeCard key={node.id} node={node} active={selected.id === node.id} onClick={() => onSelect(node)} />
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="drawer-panel" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }}>
            <div className="section-title">
              <h2>{title}</h2>
              <button className="ghost-btn" onClick={onClose}><X size={16} /> 关闭</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TrustBar() {
  return (
    <div className="trust-bar">
      {[
        ["演示库存", "sandbox 票务流程，不代表真实库存", ShieldCheck],
        ["支付沙箱", "仅模拟支付链路，不产生真实扣款", CheckCircle2],
        ["随时查订单", "进度透明，行程无忧", Ticket]
      ].map(([title, desc, Icon]) => (
        <div key={title as string}>
          <Icon size={28} />
          <strong>{title as string}</strong>
          <span>{desc as string}</span>
        </div>
      ))}
    </div>
  );
}
