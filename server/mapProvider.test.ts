import { describe, expect, it, vi } from "vitest";
import type { City, Poi } from "../src/types";
import { createMapProvider } from "./mapProvider";

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
    id: "local-jianghan",
    name: "江汉关博物馆",
    cityId: "wuhan",
    category: "历史遗迹",
    tags: ["景点", "历史"],
    lng: 114.292416,
    lat: 30.57909,
    coordinateSystem: "GCJ-02",
    address: "沿江大道95号",
    rating: 4.7
  }
];

describe("mapProvider", () => {
  it("returns deterministic fallback when AMap key is missing", async () => {
    const provider = createMapProvider({ pois, cities }, { provider: "amap", apiKey: "" });

    const result = await provider.searchPois({ cityId: "wuhan", keyword: "黄鹤楼", limit: 2 });
    const route = await provider.route({ mode: "walking" });

    expect(result.provider).toBe("amap");
    expect(result.coordinateSystem).toBe("GCJ-02");
    expect(result.fallback).toBe(true);
    expect(result.failureReason).toContain("MAP_API_KEY");
    expect(result.items[0].name).toBe("黄鹤楼");
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
          name: "黄鹤楼",
          type: "风景名胜;公园广场",
          typecode: "110000",
          address: "蛇山西山坡特1号",
          location: "114.302409,30.544404",
          pname: "湖北省",
          cityname: "武汉市",
          adname: "武昌区",
          adcode: "420106",
          biz_ext: { rating: "4.8" }
        }
      ]
    }), { status: 200 }));
    const provider = createMapProvider({ pois, cities }, { provider: "amap", apiKey: "test-key", fetchImpl });

    const result = await provider.searchPois({ cityId: "wuhan", keyword: "黄鹤楼", limit: 1 });
    const fetchCalls = fetchImpl.mock.calls;

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchCalls[0]?.[0]).toContain("/v3/place/text");
    expect(result.fallback).toBe(false);
    expect(result.provider).toBe("amap");
    expect(result.items[0]).toMatchObject({
      name: "黄鹤楼",
      lng: 114.302409,
      lat: 30.544404,
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

    const result = await provider.geocode({ keyword: "黄鹤楼", cityId: "wuhan" });

    expect(result.fallback).toBe(true);
    expect(result.point).toMatchObject({ lng: 114.302409, lat: 30.544404 });
    expect(result.failureReason).toContain("AMap error");
    expect(result.failureReason).toContain("INVALID_USER_KEY");
  });
});
