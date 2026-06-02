import { describe, expect, it } from "vitest";
import { getFeaturedPois, poiToScenicSpot, searchPois } from "./poiService";

describe("poiService", () => {
  it("searches real Hangzhou POI fallback by keyword", () => {
    const result = searchPois({ cityId: "hangzhou", keyword: "西湖", limit: 3 });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].cityId).toBe("hangzhou");
  });

  it("maps POI to safe ScenicSpot card data", () => {
    const poi = getFeaturedPois("hangzhou", 1)[0];
    const card = poiToScenicSpot(poi);
    expect(card.name).toBe(poi.name);
    expect(card.image).toBeTruthy();
    expect(card.reason).toContain("真实");
  });
});
