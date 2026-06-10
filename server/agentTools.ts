import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import type { AiToolCall, GeneratedItineraryResponse, MapPoint, RouteResult, TicketProduct, TicketSlot } from "../src/types";
import type { MapProvider, NearbyPoi, WeatherResult } from "./mapProvider";
import { isTourismPoi, SUPPORTED_TICKET_POIS } from "./travelAgent";
import { DEFAULT_CITY_CENTER, DEFAULT_CITY_ID } from "./config/city";

export type AgentDeps = {
  mapProvider: MapProvider;
  getTicketOptions: (poiId: string, visitDate?: string) => { products: TicketProduct[]; slots: TicketSlot[] };
  generateItinerary: (input: { days?: number; preferences?: string[]; cityId?: string; stops?: MapPoint[] }) => Promise<GeneratedItineraryResponse>;
};

export type CollectedArtifacts = {
  uiToolCalls: AiToolCall[];
  pois: NearbyPoi[];
  route?: RouteResult;
  weather?: WeatherResult;
  tickets?: { poiName: string; products: TicketProduct[]; slots: TicketSlot[] };
  itinerary?: GeneratedItineraryResponse;
  explicitMapStops?: MapPoint[];
  actionLabel?: string;
};

export const TOOL_LABELS: Record<string, string> = {
  search_pois: "POI 搜索",
  plan_route: "路线规划",
  get_weather: "天气查询",
  get_ticket_options: "票务候选",
  generate_itinerary: "行程编排",
  show_on_map: "同步到导览地图"
};

export function createCollectedArtifacts(): CollectedArtifacts {
  return { uiToolCalls: [], pois: [] };
}

const TOOL_TIMEOUT_MS = 10_000;

const stopSchema = z.object({
  name: z.string().min(1),
  lng: z.number(),
  lat: z.number()
});

export function createAgentTools(context: {
  deps: AgentDeps;
  writer: UIMessageStreamWriter;
  collected: CollectedArtifacts;
}) {
  const { deps, writer, collected } = context;
  // Dedup identical calls within one request — DeepSeek occasionally loops
  // on the same tool with the same arguments.
  const resultCache = new Map<string, unknown>();

  const cached = async <T>(key: string, run: () => Promise<T>): Promise<T> => {
    if (resultCache.has(key)) return resultCache.get(key) as T;
    const value = await run();
    resultCache.set(key, value);
    return value;
  };

  const record = (name: string, status: AiToolCall["status"], summary: string) => {
    collected.uiToolCalls.push({ name: TOOL_LABELS[name] ?? name, status, summary });
  };

  const emitTourIntent = (label: string, stops: MapPoint[]) => {
    writer.write({ type: "data-action", data: { type: "tour-intent", label, stops }, transient: true });
  };

  return {
    search_pois: tool({
      description: "按关键词或类目搜索武汉的旅游地点（景点/文化场馆/公园/美食/亲子）。返回名称、评分、地址和坐标。",
      inputSchema: z.object({
        keyword: z.string().optional().describe("地点关键词，如“黄鹤楼”“热干面”"),
        category: z.enum(["景点", "文化艺术", "公园自然", "美食", "亲子游"]).optional().describe("类目筛选；无关键词时必选其一"),
        limit: z.number().int().min(1).max(8).optional()
      }),
      execute: async ({ keyword, category, limit }) => {
        const key = `search_pois|${keyword ?? ""}|${category ?? ""}|${limit ?? 5}`;
        try {
          return await cached(key, async () => {
            const result = await withTimeout(deps.mapProvider.searchPois({
              cityId: DEFAULT_CITY_ID,
              keyword,
              category,
              ...(keyword ? {} : { lng: DEFAULT_CITY_CENTER.lng, lat: DEFAULT_CITY_CENTER.lat, radius: 12000 }),
              limit: limit ?? 5
            }));
            const items = result.items.filter(isTourismPoi);
            collected.pois.push(...items.filter((poi) => !collected.pois.some((existing) => existing.id === poi.id)));
            record("search_pois", items.length ? "success" : "failed",
              `命中 ${items.length} 个候选；provider：${result.provider}${result.fallback ? "（本地降级）" : ""}`);
            return {
              provider: result.provider,
              fallback: result.fallback,
              count: items.length,
              items: items.map((poi) => ({
                name: poi.name,
                category: poi.category,
                rating: poi.rating,
                address: poi.address,
                lng: poi.lng,
                lat: poi.lat
              }))
            };
          });
        } catch (error) {
          record("search_pois", "failed", describeError(error));
          throw new Error(`POI 搜索失败：${describeError(error)}`);
        }
      }
    }),

    plan_route: tool({
      description: "规划途经多个地点的真实路线（默认步行），返回总距离与时长。stops 需要带坐标，可先用 search_pois 获取。",
      inputSchema: z.object({
        stops: z.array(stopSchema).min(2).max(8),
        mode: z.enum(["walking", "transit", "driving", "bicycling"]).optional(),
        preferences: z.array(z.string()).optional()
      }),
      execute: async ({ stops, mode, preferences }) => {
        const key = `plan_route|${mode ?? "walking"}|${stops.map((stop) => `${stop.lng},${stop.lat}`).join(";")}`;
        try {
          return await cached(key, async () => {
            const result = await withTimeout(deps.mapProvider.route({
              cityId: DEFAULT_CITY_ID,
              mode: mode ?? "walking",
              preferences,
              origin: stops[0],
              destination: stops[stops.length - 1],
              waypoints: stops.slice(1, -1).slice(0, 5)
            }), 20_000);
            collected.route = result;
            record("plan_route", "success",
              `${result.mode} · ${result.distanceMeters} 米 · 约 ${result.durationMinutes} 分钟；provider：${result.provider}${result.fallback ? "（估算）" : ""}`);
            return {
              provider: result.provider,
              fallback: result.fallback,
              mode: result.mode,
              distanceMeters: result.distanceMeters,
              durationMinutes: result.durationMinutes,
              waypointNames: result.waypointNames
            };
          });
        } catch (error) {
          record("plan_route", "failed", describeError(error));
          throw new Error(`路线规划失败：${describeError(error)}`);
        }
      }
    }),

    get_weather: tool({
      description: "查询武汉当前天气。live=false 时表示没有官方实时数据，回答中不得引用具体天气数值。",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await cached("get_weather", async () => {
            const result = await withTimeout(deps.mapProvider.weather({ cityId: DEFAULT_CITY_ID }));
            collected.weather = result;
            record("get_weather", result.live ? "success" : "skipped",
              result.live ? `${result.summary ?? "已返回天气"}；provider：${result.provider}` : `未获得官方实时天气；${result.failureReason ?? "使用保守假设"}`);
            return result.live
              ? { live: true, summary: result.summary }
              : { live: false, note: "无官方实时天气数据，禁止在回答中给出具体天气结论", failureReason: result.failureReason };
          });
        } catch (error) {
          record("get_weather", "failed", describeError(error));
          throw new Error(`天气查询失败：${describeError(error)}`);
        }
      }
    }),

    get_ticket_options: tool({
      description: "查询指定景点的 sandbox 演示票务候选（票种与时段）。仅部分景点已接入；结果非真实库存，不可宣称可购买或已锁定。",
      inputSchema: z.object({
        poiName: z.string().min(1),
        visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      }),
      execute: async ({ poiName, visitDate }) => {
        const supported = SUPPORTED_TICKET_POIS.find((poi) => poi.keywords.some((keyword) => poiName.includes(keyword)));
        if (!supported) {
          record("get_ticket_options", "skipped", `「${poiName}」未接入 sandbox 票务，未查询`);
          return { supported: false, poiName, note: "该点位未接入演示票务，请勿给出票务承诺" };
        }
        try {
          const options = deps.getTicketOptions(supported.id, visitDate);
          collected.tickets = { poiName: supported.name, products: options.products, slots: options.slots };
          record("get_ticket_options", "success",
            `${supported.name} sandbox 候选 ${options.products.length} 类票、${options.slots.length} 个时段；非官方实时库存`);
          return {
            supported: true,
            sandbox: true,
            poiName: supported.name,
            products: options.products.map((product) => ({ id: product.id, name: product.name, price: product.price, status: product.status })),
            slots: options.slots.map((slot) => ({ id: slot.id, time: slot.time, status: slot.status }))
          };
        } catch (error) {
          record("get_ticket_options", "failed", describeError(error));
          throw new Error(`票务查询失败：${describeError(error)}`);
        }
      }
    }),

    generate_itinerary: tool({
      description: "生成多日逐日行程（服务端 Itinerary Agent 编排 POI、路线、天气、票务候选）。生成后行程会自动同步到行程规划页与导览地图。",
      inputSchema: z.object({
        days: z.number().int().min(1).max(5),
        preferences: z.array(z.string()).optional(),
        stops: z.array(stopSchema).optional().describe("可选：限定行程必须包含的地点")
      }),
      execute: async ({ days, preferences, stops }) => {
        try {
          const plan = await withTimeout(deps.generateItinerary({ days, preferences, cityId: DEFAULT_CITY_ID, stops }), 30_000);
          collected.itinerary = plan;
          record("generate_itinerary", "success", `已生成 ${plan.days} 天行程「${plan.title}」，${plan.items.length} 个日程节点`);
          if (plan.mapStops && plan.mapStops.length >= 2) {
            collected.explicitMapStops = collected.explicitMapStops ?? plan.mapStops;
            collected.actionLabel = collected.actionLabel ?? plan.title;
            emitTourIntent(plan.title, plan.mapStops);
          }
          return {
            title: plan.title,
            days: plan.days,
            summary: plan.summary,
            itemsBrief: plan.items.slice(0, 12).map((item) => ({ day: item.day, time: item.time, title: item.title })),
            mapStopsCount: plan.mapStops?.length ?? 0
          };
        } catch (error) {
          record("generate_itinerary", "failed", describeError(error));
          throw new Error(`行程生成失败：${describeError(error)}`);
        }
      }
    }),

    show_on_map: tool({
      description: "把一组地点同步到智能导览地图页（用户说“放地图上看/在导览里看”时调用）。需要 2-8 个带坐标的地点。",
      inputSchema: z.object({
        label: z.string().min(1).describe("这组地点的说明，如用户的原话"),
        stops: z.array(stopSchema).min(2).max(8)
      }),
      execute: async ({ label, stops }) => {
        const valid = stops.filter((stop) => Number.isFinite(stop.lng) && Number.isFinite(stop.lat));
        if (valid.length < 2) {
          record("show_on_map", "failed", "有效坐标不足 2 个，未同步");
          throw new Error("同步地图失败：有效坐标不足 2 个");
        }
        collected.explicitMapStops = valid;
        collected.actionLabel = label;
        emitTourIntent(label, valid);
        record("show_on_map", "success", `已把 ${valid.length} 个地点同步到智能导览页`);
        return { ok: true, savedStops: valid.length, note: "已同步到智能导览页，用户可直接打开查看路线" };
      }
    })
  };
}

async function withTimeout<T>(promise: Promise<T>, ms = TOOL_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`工具执行超时（${Math.round(ms / 1000)}s）`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
