import { describe, expect, it, vi } from "vitest";
import type { City, Poi, TicketProduct, TicketSlot } from "../src/types";
import { createMapProvider } from "./mapProvider";
import { runTravelAgent } from "./travelAgent";

const cities: City[] = [
  { id: "hangzhou", name: "杭州", officialName: "杭州市", pinyin: "hangzhou", adcode: "330100", level: "city" }
];

const pois: Poi[] = [
  {
    id: "local-west-lake",
    name: "西湖",
    cityId: "hangzhou",
    category: "景点",
    tags: ["景点", "少排队"],
    lng: 120.148872,
    lat: 30.245185,
    coordinateSystem: "GCJ-02",
    address: "杭州市西湖区",
    rating: 4.9
  },
  {
    id: "local-leifeng",
    name: "雷峰塔",
    cityId: "hangzhou",
    category: "历史遗迹",
    tags: ["景点", "历史"],
    lng: 120.148234,
    lat: 30.233501,
    coordinateSystem: "GCJ-02",
    address: "南山路15号",
    rating: 4.7
  },
  {
    id: "local-food",
    name: "湖滨杭帮菜",
    cityId: "hangzhou",
    category: "美食",
    tags: ["美食"],
    lng: 120.1601,
    lat: 30.251,
    coordinateSystem: "GCJ-02",
    address: "湖滨路",
    rating: 4.6
  }
];

const products: TicketProduct[] = [
  { id: "adult", poiId: "ticket-leifeng-demo", name: "成人票", desc: "sandbox candidate", price: 55, stock: 20, status: "available" }
];

const slots: TicketSlot[] = [
  { id: "morning", time: "08:00-10:00", stock: 20, status: "available" }
];

describe("travelAgent", () => {
  it("returns POI cards for the West Lake one-day quick question", async () => {
    const response = await runTravelAgent("西湖一日游，带老人，少排队", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions: () => ({ products, slots })
    });

    expect(response.text).toContain("西湖");
    expect(response.cards.length).toBeGreaterThan(0);
    expect(response.cards[0]?.title).toContain("西湖");
    expect(response.toolCalls.find((tool) => tool.name === "POI 搜索")?.status).toBe("success");
  });

  it("returns AiResponse with cards, tool calls, and safe source notes", async () => {
    const response = await runTravelAgent("帮我预约雷峰塔上午票，带老人少排队", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions: () => ({ products, slots })
    });

    expect(response.text).toContain("票务");
    expect(response.text).toContain("方案1");
    expect(response.cards.length).toBeGreaterThan(0);
    expect(response.cards.length).toBeLessThanOrEqual(3);
    expect(response.confidence).toBeGreaterThan(0);
    expect(response.sourceNote).toContain("服务端 Travel Agent");
    expect(response.sourceNote).toContain("deterministic Agent fallback");
    expect(response.sourceNote).toContain("官方接口");
    expect(response.toolCalls.map((tool) => tool.name)).toEqual([
      "POI 搜索",
      "路线规划",
      "地理编码",
      "逆地理编码",
      "天气查询",
      "票务候选"
    ]);
    expect(response.toolCalls.every((tool) => ["success", "failed", "skipped"].includes(tool.status))).toBe(true);
    expect(response.toolCalls.find((tool) => tool.name === "票务候选")?.summary).toContain("非官方实时库存");
    expect(response.toolCalls.find((tool) => tool.name === "天气查询")?.status).toBe("skipped");
  });

  it("does not return Lei Feng Tower ticket candidates for unsupported ticket places", async () => {
    const getTicketOptions = vi.fn(() => ({ products, slots }));

    const response = await runTravelAgent("帮我预约灵隐寺门票", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions
    });

    expect(getTicketOptions).not.toHaveBeenCalled();
    expect(response.text).toContain("当前未返回可用票务候选");
    expect(response.cards.some((card) => card.title.includes("雷峰塔票务候选"))).toBe(false);
    expect(response.toolCalls.find((tool) => tool.name === "票务候选")?.status).toBe("skipped");
    expect(response.toolCalls.find((tool) => tool.name === "票务候选")?.summary).toContain("未命中已接入");
    expect(response.sourceNote).toContain("票务：未返回可用候选");
  });

  it("keeps deterministic tool text authoritative when a model is configured", async () => {
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [
        { message: { content: "真实支付已完成，余票充足，天气晴朗。" } }
      ]
    }), { status: 200 }));

    const response = await runTravelAgent("帮我预约雷峰塔上午票", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions: () => ({ products, slots }),
      aiProvider: {
        provider: "test-model",
        baseURL: "https://model.example",
        apiKey: "test-key",
        fetchImpl
      }
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response.text).not.toContain("真实支付已完成");
    expect(response.text).not.toContain("天气晴朗");
    expect(response.sourceNote).toContain("最终事实文本仍由工具结果 deterministic 生成");
  });
});
