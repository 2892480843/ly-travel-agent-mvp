import { describe, expect, it, vi } from "vitest";
import type { UIMessageStreamWriter } from "ai";
import { createAgentTools, createCollectedArtifacts, type AgentDeps } from "./agentTools";
import type { MapProvider } from "./mapProvider";

function fakeWriter() {
  const written: Array<Record<string, unknown>> = [];
  return {
    writer: { write: (chunk: unknown) => written.push(chunk as Record<string, unknown>), merge: vi.fn(), onError: undefined } as unknown as UIMessageStreamWriter,
    written
  };
}

function makeDeps(overrides: Partial<MapProvider> = {}): AgentDeps {
  const mapProvider = {
    searchPois: vi.fn(async () => ({
      provider: "amap",
      coordinateSystem: "GCJ-02" as const,
      fallback: false,
      items: [
        { id: "p1", name: "黄鹤楼", cityId: "wuhan", category: "景点" as const, tags: [], lng: 114.3, lat: 30.54, coordinateSystem: "GCJ-02" as const, rating: 4.8 },
        { id: "p2", name: "晴川阁", cityId: "wuhan", category: "景点" as const, tags: [], lng: 114.29, lat: 30.55, coordinateSystem: "GCJ-02" as const }
      ]
    })),
    route: vi.fn(async () => ({
      provider: "amap", coordinateSystem: "GCJ-02" as const, mode: "walking" as const,
      distanceMeters: 3200, durationMinutes: 45,
      points: [{ lng: 114.3, lat: 30.54 }, { lng: 114.29, lat: 30.55 }],
      waypointNames: ["黄鹤楼", "晴川阁"], preferences: [], fallback: false
    })),
    weather: vi.fn(async () => ({ provider: "amap", live: false, failureReason: "no key" })),
    geocode: vi.fn(), reverseGeocode: vi.fn(),
    ...overrides
  } as unknown as MapProvider;
  return {
    mapProvider,
    getTicketOptions: vi.fn(() => ({
      products: [{ id: "adult", poiId: "x", name: "成人票", desc: "", price: 40, stock: 10, status: "available" as const }],
      slots: [{ id: "s1", time: "08:00-10:00", stock: 5, status: "available" as const }]
    })),
    generateItinerary: vi.fn(async () => ({
      cityId: "wuhan", days: 2, nights: 1, title: "武汉 2 日游", preferences: [],
      summary: [], reasons: [], constraints: [], budget: { totalPerPerson: 2000, days: 2, breakdown: [] },
      items: [{ day: "Day 1", time: "09:00", title: "黄鹤楼", type: "spot" as const }],
      sourceNote: "", toolCalls: [],
      mapStops: [{ name: "黄鹤楼", lng: 114.3, lat: 30.54 }, { name: "晴川阁", lng: 114.29, lat: 30.55 }]
    }))
  };
}

describe("agentTools", () => {
  it("search_pois returns compact items and records a ui tool call", async () => {
    const { writer } = fakeWriter();
    const collected = createCollectedArtifacts();
    const tools = createAgentTools({ deps: makeDeps(), writer, collected });

    const result = await (tools.search_pois as { execute: (input: unknown, opts: unknown) => Promise<unknown> })
      .execute({ keyword: "黄鹤楼", limit: 2 }, {} as never) as { count: number; items: Array<{ name: string }> };

    expect(result.count).toBe(2);
    expect(result.items[0]).toMatchObject({ name: "黄鹤楼", lng: 114.3 });
    expect(collected.pois).toHaveLength(2);
    expect(collected.uiToolCalls[0]).toMatchObject({ name: "POI 搜索", status: "success" });
  });

  it("get_ticket_options skips unsupported pois without calling the repo", async () => {
    const deps = makeDeps();
    const { writer } = fakeWriter();
    const collected = createCollectedArtifacts();
    const tools = createAgentTools({ deps, writer, collected });

    const result = await (tools.get_ticket_options as { execute: (input: unknown, opts: unknown) => Promise<unknown> })
      .execute({ poiName: "东湖" }, {} as never) as { supported: boolean };

    expect(result.supported).toBe(false);
    expect(deps.getTicketOptions).not.toHaveBeenCalled();
    expect(collected.uiToolCalls[0]).toMatchObject({ name: "票务候选", status: "skipped" });
  });

  it("show_on_map validates coordinates and emits a tour-intent data part", async () => {
    const { writer, written } = fakeWriter();
    const collected = createCollectedArtifacts();
    const tools = createAgentTools({ deps: makeDeps(), writer, collected });
    const exec = (tools.show_on_map as { execute: (input: unknown, opts: unknown) => Promise<unknown> }).execute;

    await expect(exec({ label: "测试", stops: [{ name: "a", lng: Number.NaN, lat: 1 }, { name: "b", lng: Number.NaN, lat: 2 }] }, {} as never))
      .rejects.toThrow("有效坐标不足");

    const ok = await exec({
      label: "黄鹤楼一日游",
      stops: [{ name: "黄鹤楼", lng: 114.3, lat: 30.54 }, { name: "晴川阁", lng: 114.29, lat: 30.55 }]
    }, {} as never) as { ok: boolean; savedStops: number };

    expect(ok).toMatchObject({ ok: true, savedStops: 2 });
    expect(collected.explicitMapStops).toHaveLength(2);
    const action = written.find((chunk) => chunk.type === "data-action") as { data: { type: string; stops: unknown[] } };
    expect(action.data).toMatchObject({ type: "tour-intent" });
    expect(action.data.stops).toHaveLength(2);
  });

  it("generate_itinerary collects the plan and emits tour-intent", async () => {
    const { writer, written } = fakeWriter();
    const collected = createCollectedArtifacts();
    const tools = createAgentTools({ deps: makeDeps(), writer, collected });

    const result = await (tools.generate_itinerary as { execute: (input: unknown, opts: unknown) => Promise<unknown> })
      .execute({ days: 2 }, {} as never) as { title: string; mapStopsCount: number };

    expect(result).toMatchObject({ title: "武汉 2 日游", mapStopsCount: 2 });
    expect(collected.itinerary?.title).toBe("武汉 2 日游");
    expect(written.some((chunk) => chunk.type === "data-action")).toBe(true);
  });
});
