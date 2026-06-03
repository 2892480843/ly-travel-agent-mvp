import { describe, expect, it, vi } from "vitest";
import type { City, Poi, TicketProduct, TicketSlot } from "../src/types";
import type { MapProvider } from "./mapProvider";
import { createMapProvider } from "./mapProvider";
import { runTravelAgent } from "./travelAgent";

const cities: City[] = [
  { id: "wuhan", name: "武汉", officialName: "武汉市", pinyin: "wuhan", adcode: "420100", level: "prefecture-city" }
];

const pois: Poi[] = [
  {
    id: "wuhan-b001b0i4k0",
    name: "黄鹤楼",
    cityId: "wuhan",
    category: "景点",
    tags: ["景点", "少排队"],
    lng: 114.302409,
    lat: 30.544404,
    coordinateSystem: "GCJ-02",
    address: "武汉市武昌区蛇山西山坡特1号",
    rating: 4.9
  },
  {
    id: "local-hubei-museum",
    name: "湖北省博物馆",
    cityId: "wuhan",
    category: "文化艺术",
    tags: ["景点", "文化"],
    lng: 114.365516,
    lat: 30.561728,
    coordinateSystem: "GCJ-02",
    address: "武汉市武昌区东湖路160号",
    rating: 4.7
  },
  {
    id: "local-food",
    name: "肥肥虾庄",
    cityId: "wuhan",
    category: "美食",
    tags: ["美食"],
    lng: 114.284855,
    lat: 30.581833,
    coordinateSystem: "GCJ-02",
    address: "江汉路M+购物中心",
    rating: 4.6
  }
];

const products: TicketProduct[] = [
  { id: "adult", poiId: "ticket-yellow-crane-tower-demo", name: "成人票", desc: "sandbox candidate", price: 55, stock: 20, status: "available" }
];

const slots: TicketSlot[] = [
  { id: "morning", time: "08:00-10:00", stock: 20, status: "available" }
];

describe("travelAgent", () => {
  it("clarifies pure greetings without defaulting to Yellow Crane Tower tools", async () => {
    const mapProvider = {
      searchPois: vi.fn(),
      route: vi.fn(),
      geocode: vi.fn(),
      reverseGeocode: vi.fn(),
      weather: vi.fn()
    } as unknown as MapProvider;
    const getTicketOptions = vi.fn(() => ({ products, slots }));

    const response = await runTravelAgent("你好", {
      mapProvider,
      getTicketOptions
    });

    expect(response.text).toContain("武汉文旅助手");
    expect(response.text).not.toContain("方案1");
    expect(response.text).not.toContain("黄鹤楼");
    expect(response.cards).toEqual([]);
    expect(response.toolCalls.every((tool) => tool.status === "skipped")).toBe(true);
    expect(mapProvider.searchPois).not.toHaveBeenCalled();
    expect(mapProvider.route).not.toHaveBeenCalled();
    expect(mapProvider.geocode).not.toHaveBeenCalled();
    expect(mapProvider.reverseGeocode).not.toHaveBeenCalled();
    expect(mapProvider.weather).not.toHaveBeenCalled();
    expect(getTicketOptions).not.toHaveBeenCalled();
  });

  it("returns POI cards for the Yellow Crane Tower one-day quick question", async () => {
    const response = await runTravelAgent("黄鹤楼一日游，带老人，少排队", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions: () => ({ products, slots })
    });

    expect(response.text).toContain("黄鹤楼");
    expect(response.cards.length).toBeGreaterThan(0);
    expect(response.cards[0]?.title).toContain("黄鹤楼");
    expect(response.toolCalls.find((tool) => tool.name === "POI 搜索")?.status).toBe("success");
  });

  it("returns AiResponse with cards, tool calls, and safe source notes", async () => {
    const response = await runTravelAgent("帮我预约黄鹤楼上午票，带老人少排队", {
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

  it("does not return Yellow Crane Tower ticket candidates for unsupported or unstable ticket places", async () => {
    const getTicketOptions = vi.fn(() => ({ products, slots }));

    const response = await runTravelAgent("帮我预约东湖门票", {
      mapProvider: createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" }),
      getTicketOptions
    });

    expect(getTicketOptions).not.toHaveBeenCalled();
    expect(response.text).toContain("当前未返回可用票务候选");
    expect(response.cards.some((card) => card.title.includes("黄鹤楼票务候选"))).toBe(false);
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

    const response = await runTravelAgent("帮我预约黄鹤楼上午票", {
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
