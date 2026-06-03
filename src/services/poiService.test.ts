import { describe, expect, it } from "vitest";
import { filterRecommendedPois, getFeaturedPois, poiToScenicSpot, recommendationFilters, searchPois } from "./poiService";

describe("poiService", () => {
  it("searches real Wuhan POI fallback by keyword", () => {
    const result = searchPois({ cityId: "wuhan", keyword: "黄鹤楼", limit: 3 });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].cityId).toBe("wuhan");
  });

  it("maps POI to safe ScenicSpot card data", () => {
    const poi = getFeaturedPois("wuhan", 1)[0];
    const card = poiToScenicSpot(poi);
    expect(card.name).toBe(poi.name);
    expect(card.image).toBeTruthy();
    expect(card.reason).toContain("真实");
  });

  it("filters recommendations by user intent", () => {
    const pois = searchPois({ cityId: "wuhan", limit: 30 });
    const allNames = filterRecommendedPois(pois, "全部推荐").map((poi) => poi.name);

    for (const filter of recommendationFilters) {
      expect(filterRecommendedPois(pois, filter).length, filter).toBeGreaterThan(0);
    }

    expect(filterRecommendedPois(pois, "美食").every((poi) => poi.category === "美食")).toBe(true);
    expect(filterRecommendedPois(pois, "少排队").every((poi) => ["较少", "舒适"].includes(poiToScenicSpot(poi).crowd))).toBe(true);
    expect(filterRecommendedPois(pois, "夜游").some((poi) => poi.category === "夜生活")).toBe(true);
    expect(filterRecommendedPois(pois, "适合带娃").some((poi) => poi.category === "亲子游")).toBe(true);
    expect(filterRecommendedPois(pois, "Citywalk").map((poi) => poi.name)).not.toEqual(allNames);
  });
});
