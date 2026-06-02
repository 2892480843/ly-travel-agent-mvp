import { realCities, realPoiPreview } from "../data/realPoiPreview";
import type { City, Poi, PoiSearchParams, ScenicSpot, StatusTone } from "../types";
import { DEFAULT_CITY_ID, DEFAULT_CITY_NAME } from "../config/city";

const fallbackImage = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

const normalize = (value: string) => value.trim().toLowerCase();

export function searchPois(params: PoiSearchParams = {}, source: Poi[] = realPoiPreview): Poi[] {
  const keyword = params.keyword ? normalize(params.keyword) : "";
  const tags = params.tags?.map(normalize) ?? [];
  const limit = params.limit ?? 12;

  return source
    .filter((poi) => {
      const text = normalize([poi.name, poi.address, poi.category, poi.description, ...poi.tags].filter(Boolean).join(" "));
      const matchesKeyword = !keyword || text.includes(keyword);
      const matchesCity = !params.cityId || poi.cityId === params.cityId;
      const matchesCategory = !params.category || params.category === "全部" || poi.category === params.category;
      const matchesTags = tags.length === 0 || tags.some((tag) => text.includes(tag));
      return matchesKeyword && matchesCity && matchesCategory && matchesTags;
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

export function getPoiById(id: string, source: Poi[] = realPoiPreview): Poi | undefined {
  return source.find((poi) => poi.id === id);
}

export function getFeaturedPois(cityId = DEFAULT_CITY_ID, limit = 8): Poi[] {
  return searchPois({ cityId, limit });
}

export function getCities(): City[] {
  return realCities;
}

export function getPoiCategories(source: Poi[] = realPoiPreview) {
  return Array.from(new Set(source.map((poi) => poi.category)));
}

export function poiToScenicSpot(poi: Poi): ScenicSpot {
  const crowdOptions: Array<ScenicSpot["crowd"]> = ["舒适", "较少", "适中"];
  const crowd = crowdOptions[Math.abs(hashText(poi.id)) % crowdOptions.length];
  const area = poi.tags.find((tag) => tag.endsWith("区")) ?? poi.address?.slice(0, 8) ?? DEFAULT_CITY_NAME;
  return {
    name: poi.name,
    image: poi.cover ?? poi.images?.[0] ?? fallbackImage,
    rating: poi.rating ?? 4.5,
    crowd,
    tags: poi.tags.slice(0, 3),
    reason: buildReason(poi, crowd),
    duration: poi.suggestedDuration ?? "1-2 小时",
    location: area,
    weather: "晴 26℃",
    distance: `${(Math.abs(hashText(poi.name)) % 80 / 10 + 0.8).toFixed(1)}km`
  };
}

export function statusForStock(status: "available" | "low" | "soldOut" | "verify"): { label: string; tone: StatusTone } {
  if (status === "soldOut") return { label: "已售罄", tone: "red" };
  if (status === "low") return { label: "余票紧张", tone: "orange" };
  if (status === "verify") return { label: "需核验", tone: "purple" };
  return { label: "库存充足", tone: "green" };
}

function buildReason(poi: Poi, crowd: ScenicSpot["crowd"]) {
  const source = poi.source?.provider === "amap" ? "高德真实 POI" : "本地真实数据子集";
  return `${source}命中，评分 ${poi.rating ?? "暂无"}，当前模拟客流为${crowd}。${poi.openingHours ? "已保留可信开放时间。" : "开放时间以官方公告为准。"}`;
}

function hashText(value: string) {
  return value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
