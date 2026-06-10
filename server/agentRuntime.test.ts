import { Writable } from "node:stream";
import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { closeDb, initializeDatabase } from "./db";
import { getOrCreateConversation, listUiMessages } from "./conversationStore";
import { streamAgentChat } from "./agentRuntime";
import { createMapProvider } from "./mapProvider";
import type { AgentDeps } from "./agentTools";
import type { City, Poi } from "../src/types";

const savedEnv = { ...process.env };

const cities: City[] = [
  { id: "wuhan", name: "武汉", officialName: "武汉市", pinyin: "wuhan", adcode: "420100", level: "prefecture-city" }
];
const pois: Poi[] = [
  { id: "p1", name: "黄鹤楼", cityId: "wuhan", category: "景点", tags: ["景点"], lng: 114.302409, lat: 30.544404, coordinateSystem: "GCJ-02", rating: 4.9 },
  { id: "p2", name: "晴川阁", cityId: "wuhan", category: "景点", tags: ["景点"], lng: 114.2952, lat: 30.5566, coordinateSystem: "GCJ-02", rating: 4.7 },
  { id: "p3", name: "江汉关博物馆", cityId: "wuhan", category: "历史遗迹", tags: ["景点"], lng: 114.292416, lat: 30.57909, coordinateSystem: "GCJ-02", rating: 4.7 },
  { id: "p4", name: "湖北省博物馆", cityId: "wuhan", category: "文化艺术", tags: ["景点"], lng: 114.366, lat: 30.564, coordinateSystem: "GCJ-02", rating: 4.9 }
];

class FakeServerResponse extends Writable {
  statusCode = 0;
  headers: Record<string, string> = {};
  chunks: Buffer[] = [];
  writeHead(statusCode: number, headers?: Record<string, string>) {
    this.statusCode = statusCode;
    if (headers) this.headers = { ...this.headers, ...headers };
    return this;
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  override _write(chunk: Buffer, _enc: BufferEncoding, callback: () => void) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
  get text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
  waitForEnd() {
    return new Promise<void>((resolve) => this.once("finish", resolve));
  }
}

function makeDeps(): AgentDeps {
  return {
    mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
    getTicketOptions: () => ({
      products: [{ id: "adult", poiId: "x", name: "成人票", desc: "", price: 40, stock: 10, status: "available" }],
      slots: [{ id: "s1", time: "08:00-10:00", stock: 5, status: "available" }]
    }),
    generateItinerary: async () => ({
      cityId: "wuhan", days: 2, nights: 1, title: "武汉 2 日游", preferences: [],
      summary: [], reasons: [], constraints: [], budget: { totalPerPerson: 2000, days: 2, breakdown: [] },
      items: [], sourceNote: "", toolCalls: [],
      mapStops: [{ name: "黄鹤楼", lng: 114.3, lat: 30.54 }, { name: "晴川阁", lng: 114.29, lat: 30.55 }]
    })
  };
}

const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };

function twoStepModel(finalText: string, firstToolCall?: { toolName: string; input: string }) {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      call += 1;
      if (call === 1 && firstToolCall) {
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "stream-start" as const, warnings: [] },
              { type: "tool-call" as const, toolCallId: "call-1", toolName: firstToolCall.toolName, input: firstToolCall.input },
              { type: "finish" as const, finishReason: "tool-calls" as const, usage }
            ]
          })
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "t1" },
            { type: "text-delta" as const, id: "t1", delta: finalText },
            { type: "text-end" as const, id: "t1" },
            { type: "finish" as const, finishReason: "stop" as const, usage }
          ]
        })
      };
    }
  });
}

describe("agentRuntime streamAgentChat", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ":memory:";
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    initializeDatabase();
  });

  afterEach(() => {
    closeDb();
    process.env = { ...savedEnv };
  });

  it("runs tool round then streams final text, attaches metadata and persists the turn", async () => {
    const response = new FakeServerResponse();
    await streamAgentChat({
      text: "黄鹤楼附近有什么好玩的？",
      ctx: { userId: "visitor", model: twoStepModel("推荐黄鹤楼与晴川阁，步行可达。", { toolName: "search_pois", input: JSON.stringify({ category: "景点", limit: 3 }) }) },
      deps: makeDeps(),
      response: response as unknown as ServerResponse
    });
    await response.waitForEnd();

    const body = response.text;
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(body).toContain("data-meta");
    expect(body).toContain("search_pois");
    expect(body).toContain("推荐黄鹤楼与晴川阁");
    expect(body).toContain("message-metadata");

    const conv = getOrCreateConversation("visitor");
    const messages = listUiMessages(conv.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user" });
    const assistant = messages[1] as { metadata?: { aiResponse?: { toolCalls: Array<{ name: string }>; mapStops?: unknown[] } } };
    expect(assistant.metadata?.aiResponse?.toolCalls.some((tool) => tool.name === "POI 搜索")).toBe(true);
    expect(assistant.metadata?.aiResponse?.mapStops?.length).toBeGreaterThanOrEqual(2);
  });

  it("emits tour-intent action when the model calls show_on_map", async () => {
    const response = new FakeServerResponse();
    const stops = [
      { name: "黄鹤楼", lng: 114.3, lat: 30.54 },
      { name: "晴川阁", lng: 114.29, lat: 30.55 }
    ];
    await streamAgentChat({
      text: "把这两个地方放地图上看看",
      ctx: { userId: "visitor", model: twoStepModel("已为你同步到导览地图。", { toolName: "show_on_map", input: JSON.stringify({ label: "用户的两个地点", stops }) }) },
      deps: makeDeps(),
      response: response as unknown as ServerResponse
    });
    await response.waitForEnd();

    expect(response.text).toContain("data-action");
    expect(response.text).toContain("tour-intent");
  });

  it("sanitizes guardrail-violating final text via metadata.sanitizedText", async () => {
    const response = new FakeServerResponse();
    await streamAgentChat({
      text: "帮我订票",
      ctx: { userId: "visitor", model: twoStepModel("真实支付已完成，天气晴朗，请放心出行。", { toolName: "search_pois", input: JSON.stringify({ keyword: "黄鹤楼" }) }) },
      deps: makeDeps(),
      response: response as unknown as ServerResponse
    });
    await response.waitForEnd();

    const conv = getOrCreateConversation("visitor");
    const assistant = listUiMessages(conv.id)[1] as { metadata?: { sanitizedText?: string; aiResponse?: { text: string; sourceNote: string } } };
    expect(assistant.metadata?.sanitizedText).toBeTruthy();
    expect(assistant.metadata?.aiResponse?.text).not.toContain("真实支付已完成");
    expect(assistant.metadata?.aiResponse?.sourceNote).toContain("安全校验");
  });

  it("falls back to the deterministic pipeline when no model is configured", async () => {
    const response = new FakeServerResponse();
    await streamAgentChat({
      text: "帮我规划黄鹤楼一日游",
      ctx: { userId: "visitor" },
      deps: makeDeps(),
      response: response as unknown as ServerResponse
    });
    await response.waitForEnd();

    expect(response.text).toContain("deterministic");
    const conv = getOrCreateConversation("visitor");
    const assistant = listUiMessages(conv.id)[1] as { metadata?: { aiResponse?: { sourceNote: string } } };
    expect(assistant.metadata?.aiResponse?.sourceNote).toContain("未配置 AI_PROVIDER");
  });
});
