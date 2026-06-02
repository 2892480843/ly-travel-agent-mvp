import { describe, expect, it, vi } from "vitest";
import type { City, Poi } from "../src/types";
import { createMapProvider } from "./mapProvider";

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
  }
];

describe("mapProvider", () => {
  it("returns deterministic fallback when AMap key is missing", async () => {
    const provider = createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" });

    const result = await provider.searchPois({ cityId: "hangzhou", keyword: "西湖", limit: 2 });
    const route = await provider.route({ mode: "walking" });

    expect(result.provider).toBe("amap");
    expect(result.coordinateSystem).toBe("GCJ-02");
    expect(result.fallback).toBe(true);
    expect(result.failureReason).toContain("MAP_API_KEY");
    expect(result.items[0].name).toBe("西湖");
    expect(route.fallback).toBe(true);
    expect(route.points.length).toBeGreaterThanOrEqual(2);
  });

  it("maps AMap POI response to the unified provider shape", async () => {
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({
      status: "1",
      infocode: "10000",
      pois: [
        {
          id: "B0FFF",
          name: "西湖音乐喷泉",
          type: "风景名胜;公园广场",
          typecode: "110000",
          address: "湖滨",
          location: "120.160000,30.250000",
          pname: "浙江省",
          cityname: "杭州市",
          adname: "上城区",
          adcode: "330102",
          biz_ext: { rating: "4.8" }
        }
      ]
    }), { status: 200 }));
    const provider = createMapProvider({ pois, cities }, { provider: "amap", apiKey: "test-key", fetchImpl });

    const result = await provider.searchPois({ cityId: "hangzhou", keyword: "西湖", limit: 1 });
    const fetchCalls = fetchImpl.mock.calls;

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchCalls[0]?.[0]).toContain("/v3/place/text");
    expect(result.fallback).toBe(false);
    expect(result.provider).toBe("amap");
    expect(result.items[0]).toMatchObject({
      name: "西湖音乐喷泉",
      lng: 120.16,
      lat: 30.25,
      coordinateSystem: "GCJ-02",
      source: { provider: "amap", amapId: "B0FFF" }
    });
  });

  it("falls back with failure reason when AMap status validation fails", async () => {
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({
      status: "0",
      infocode: "10001",
      info: "INVALID_USER_KEY"
    }), { status: 200 }));
    const provider = createMapProvider({ pois, cities }, { provider: "amap", apiKey: "bad-key", fetchImpl });

    const result = await provider.geocode({ keyword: "西湖", cityId: "hangzhou" });

    expect(result.fallback).toBe(true);
    expect(result.point).toMatchObject({ lng: 120.148872, lat: 30.245185 });
    expect(result.failureReason).toContain("AMap error");
    expect(result.failureReason).toContain("INVALID_USER_KEY");
  });
});
