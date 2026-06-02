import type { AiResponse, AiToolCall, MapPoint, Poi, RouteMode, TicketProduct, TicketSlot } from "../src/types";
import type { GeocodeResult, MapProvider, MapProviderMeta, NearbyPoi, PoiSearchResult, ReverseGeocodeResult, RouteRequest, WeatherResult } from "./mapProvider";
import { DEFAULT_CITY_ID, DEFAULT_TICKET_DEMO_POI_ID, DEFAULT_TICKET_POI_NAME, DEFAULT_TICKET_ROUTE } from "./config/city";

export type TravelAgentDependencies = {
  mapProvider: MapProvider;
  getTicketOptions: (poiId: string, visitDate?: string) => { products: TicketProduct[]; slots: TicketSlot[] };
  aiProvider?: {
    provider?: string;
    baseURL?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  };
};

const UNSUPPORTED_STABLE_POI_KEYWORD = "未接入稳定POI";
const TICKET_INTENT_PATTERN = /预约|票|门票|核销|订单|库存|余票|演出|支付/;
const SUPPORTED_TICKET_POIS = [
  { id: DEFAULT_TICKET_DEMO_POI_ID, name: DEFAULT_TICKET_POI_NAME, keywords: [DEFAULT_TICKET_POI_NAME, "黄鹤"] }
];

export async function runTravelAgent(input: string, dependencies: TravelAgentDependencies): Promise<AiResponse> {
  const query = input.trim();
  if (!query) {
    return {
      text: "请告诉我你的目的地、同行人群或想避开的限制，我会基于 POI、路线、天气和票务候选生成建议。",
      cards: [],
      toolCalls: [
        { name: "POI 搜索", status: "skipped", summary: "输入为空，未执行检索" },
        { name: "路线规划", status: "skipped", summary: "输入为空，未执行规划" },
        { name: "地理编码", status: "skipped", summary: "输入为空，未解析地点" },
        { name: "逆地理编码", status: "skipped", summary: "输入为空，未反查地址" },
        { name: "天气查询", status: "skipped", summary: "输入为空，未查询天气" },
        { name: "票务候选", status: "skipped", summary: "输入为空，未查询票务候选" }
      ],
      confidence: 0.2,
      sourceNote: "服务端 Travel Agent 未调用模型；请补充问题。"
    };
  }

  const intent = inferIntent(query);
  const geocodeResult = await dependencies.mapProvider.geocode({ keyword: intent.placeKeyword, cityId: DEFAULT_CITY_ID });
  const center = geocodeResult.point;
  const poiResult = await dependencies.mapProvider.searchPois({
    cityId: DEFAULT_CITY_ID,
    keyword: intent.poiKeyword,
    lng: center?.lng,
    lat: center?.lat,
    tags: intent.poiKeyword ? [] : intent.tags,
    limit: 4
  });
  const reverseResult = center
    ? await dependencies.mapProvider.reverseGeocode({ lng: center.lng, lat: center.lat, cityId: DEFAULT_CITY_ID })
    : undefined;
  const routeResult = await dependencies.mapProvider.route(buildRouteRequest(poiResult, intent.routeMode));
  const weatherResult = await dependencies.mapProvider.weather({ cityId: DEFAULT_CITY_ID });
  const ticketResult = resolveTicketCandidates(query, dependencies.getTicketOptions);

  const toolCalls: AiToolCall[] = [
    toolCallFromMap("POI 搜索", poiResult, poiResult.items.length > 0, `命中 ${poiResult.items.length} 个候选`),
    toolCallFromMap("路线规划", routeResult, routeResult.points.length >= 2, `${routeResult.mode} · ${routeResult.distanceMeters} 米 · 约 ${routeResult.durationMinutes} 分钟`),
    toolCallFromMap("地理编码", geocodeResult, Boolean(geocodeResult.point), geocodeResult.point ? `${intent.placeKeyword} → ${formatPoint(geocodeResult.point)}` : "未解析出坐标"),
    reverseResult
      ? toolCallFromMap("逆地理编码", reverseResult, Boolean(reverseResult.address || reverseResult.poi), reverseResult.address ?? reverseResult.poi?.name ?? "已反查附近地点")
      : { name: "逆地理编码", status: "skipped", summary: "未获得可反查坐标" },
    weatherToolCall(weatherResult),
    ticketResult.toolCall
  ];

  const deterministic = composeAgentResponse({
    query,
    poiResult,
    routeResult,
    weatherResult,
    ticketResult,
    toolCalls
  });
  const modelText = await tryModelCompletion(query, deterministic, dependencies.aiProvider);

  return {
    ...deterministic,
    sourceNote: modelText.sourceNote ?? deterministic.sourceNote
  };
}

function inferIntent(query: string) {
  const placeKeyword = resolvePlaceKeyword(query);
  const tags = [
    query.includes("老人") || query.includes("少排队") ? "少排队" : "",
    query.includes("亲子") || query.includes("孩子") ? "亲子" : "",
    query.includes("美食") || query.includes("吃") ? "美食" : "",
    query.includes("无障碍") || query.includes("轮椅") ? "无障碍" : ""
  ].filter(Boolean);
  return {
    placeKeyword,
    poiKeyword: resolvePoiKeyword(query, placeKeyword),
    tags,
    routeMode: inferRouteMode(query)
  };
}

function resolvePlaceKeyword(query: string) {
  if (/东湖|楚河|汉街|户部巷/.test(query)) return UNSUPPORTED_STABLE_POI_KEYWORD;
  if (/黄鹤|黄鹤楼/.test(query)) return DEFAULT_TICKET_POI_NAME;
  if (/湖北省博物馆|省博|博物馆/.test(query)) return "湖北省博物馆";
  if (/江汉关/.test(query)) return "江汉关博物馆";
  if (/江滩/.test(query)) return "汉口江滩";
  if (/动物园|亲子|孩子|儿童/.test(query)) return "武汉动物园";
  if (/美食|吃|餐厅|小吃|咖啡|茶|夜市/.test(query)) return "美食";
  return DEFAULT_TICKET_POI_NAME;
}

function resolvePoiKeyword(query: string, placeKeyword: string) {
  if (placeKeyword === UNSUPPORTED_STABLE_POI_KEYWORD) return UNSUPPORTED_STABLE_POI_KEYWORD;
  if (/美食|吃|餐厅|小吃|咖啡|茶/.test(query)) return "美食";
  if (/亲子|孩子|儿童|研学/.test(query)) return "亲子";
  if (/活动|展览|演出|博物馆/.test(query)) return "文化";
  return placeKeyword;
}

function inferRouteMode(query: string): RouteMode {
  if (/自驾|开车|驾车/.test(query)) return "driving";
  if (/公交|地铁|巴士/.test(query)) return "transit";
  if (/骑行|单车|自行车/.test(query)) return "bicycling";
  return "walking";
}

function buildRouteRequest(poiResult: PoiSearchResult, mode: RouteMode): RouteRequest {
  const pois = poiResult.items;
  const origin = pois[0] ? pointFromPoi(pois[0]) : undefined;
  const destination = pois.length > 1 ? pointFromPoi(pois[pois.length - 1]) : undefined;
  const waypoints = pois.slice(1, -1).map(pointFromPoi);
  return {
    cityId: DEFAULT_CITY_ID,
    origin,
    destination,
    waypoints,
    mode,
    preferences: ["少排队", "少走回头路", "保留休息点"]
  };
}

function resolveTicketCandidates(query: string, getTicketOptions: TravelAgentDependencies["getTicketOptions"]) {
  const wantsTicket = TICKET_INTENT_PATTERN.test(query);
  if (!wantsTicket) {
    return {
      wantsTicket,
      poiName: undefined as string | undefined,
      products: [] as TicketProduct[],
      slots: [] as TicketSlot[],
      toolCall: { name: "票务候选", status: "skipped", summary: "用户未表达票务意图，未查询候选" } satisfies AiToolCall
    };
  }

  const supportedPoi = SUPPORTED_TICKET_POIS.find((poi) => poi.keywords.some((keyword) => query.includes(keyword)));
  if (!supportedPoi) {
    return {
      wantsTicket,
      poiName: undefined as string | undefined,
      products: [] as TicketProduct[],
      slots: [] as TicketSlot[],
      toolCall: {
        name: "票务候选",
        status: "skipped",
        summary: "当前未命中已接入的 sandbox 票务点位；未生成票价、库存、核销或支付结果，以官方渠道为准"
      } satisfies AiToolCall
    };
  }

  try {
    const ticketOptions = getTicketOptions(supportedPoi.id);
    return {
      wantsTicket,
      poiName: supportedPoi.name,
      products: ticketOptions.products,
      slots: ticketOptions.slots,
      toolCall: {
        name: "票务候选",
        status: ticketOptions.products.length > 0 && ticketOptions.slots.length > 0 ? "success" : "failed",
        summary: ticketOptions.products.length > 0 && ticketOptions.slots.length > 0
          ? `返回 ${supportedPoi.name} ${ticketOptions.products.length} 个 sandbox 候选；非官方实时库存、价格、锁票、核销或支付结果`
          : "未找到票务候选；请以官方票务渠道为准"
      } satisfies AiToolCall
    };
  } catch (error) {
    return {
      wantsTicket,
      poiName: supportedPoi.name,
      products: [] as TicketProduct[],
      slots: [] as TicketSlot[],
      toolCall: {
        name: "票务候选",
        status: "failed",
        summary: `${error instanceof Error ? error.message : "票务候选查询失败"}；未返回实时库存、价格或支付结果`
      } satisfies AiToolCall
    };
  }
}

function composeAgentResponse(input: {
  query: string;
  poiResult: PoiSearchResult;
  routeResult: Awaited<ReturnType<MapProvider["route"]>>;
  weatherResult: WeatherResult;
  ticketResult: ReturnType<typeof resolveTicketCandidates>;
  toolCalls: AiToolCall[];
}): AiResponse {
  const poiNames = input.poiResult.items.map((poi) => poi.name).slice(0, 3);
  const weatherLine = input.weatherResult.live
    ? `天气参考 ${input.weatherResult.summary}`
    : "天气未获得官方实时数据，不据此判断出行风险";
  const routeLine = `${input.routeResult.mode} 约 ${formatDistance(input.routeResult.distanceMeters)} / ${input.routeResult.durationMinutes} 分钟；${input.routeResult.fallback ? "路线为 fallback 估算" : "路线来自地图 provider"}，实际路况以官方地图为准；${weatherLine}`;
  const textLines = [
    poiNames.length > 0
      ? `方案1：优先考虑 ${poiNames.join("、")}，按评分、距离、标签和同行人群取舍。`
      : "方案1：暂未命中稳定 POI 候选，建议补充更具体地点或游玩偏好。",
    `方案2：路线按 ${routeLine}。`,
    ticketLine(input.ticketResult)
  ].filter(Boolean);
  const text = textLines.join("\n");
  const cards = input.ticketResult.products.length > 0
    ? [
      ...input.poiResult.items.slice(0, 2).map(poiToCard),
      ticketCard(input.ticketResult)
    ]
    : input.poiResult.items.slice(0, 3).map(poiToCard);

  return {
    text,
    cards,
    toolCalls: input.toolCalls,
    confidence: confidenceFromTools(input.toolCalls),
    sourceNote: buildSourceNote(input.poiResult, input.routeResult, input.weatherResult, input.ticketResult)
  };
}

async function tryModelCompletion(query: string, fallback: AiResponse, config?: TravelAgentDependencies["aiProvider"]) {
  const provider = config?.provider ?? process.env.AI_PROVIDER ?? "fallback";
  const baseURL = config?.baseURL ?? process.env.AI_BASE_URL;
  const apiKey = config?.apiKey ?? process.env.AI_API_KEY;
  const model = config?.model ?? process.env.AI_MODEL ?? "demo-local";
  if (provider === "fallback" || !baseURL || !apiKey) {
    return {
      sourceNote: `${fallback.sourceNote} 服务端未配置 AI_PROVIDER/AI_API_KEY，使用 deterministic Agent fallback。`
    };
  }

  const fetchImpl = config?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = config?.timeoutMs ?? positiveInteger(process.env.AI_TIMEOUT_MS) ?? 6000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: [
          "You are a travel agent for a culture-tourism-sports MVP.",
          "Reply in Simplified Chinese.",
          "Use the provided tool outputs only.",
          "Never claim ticket payment success, real-time inventory, opening hours, live weather, or prices unless official tool data is present.",
          "Keep the answer concise and actionable."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          query,
          fallbackText: fallback.text,
          cards: fallback.cards.map((card) => ({ title: card.title, subtitle: card.subtitle })),
          toolCalls: fallback.toolCalls,
          sourceNote: fallback.sourceNote
        })
      }
    ],
    max_tokens: positiveInteger(process.env.AI_MAX_TOKENS) ?? 700
  };
  if (provider === "deepseek") {
    body.thinking = { type: "disabled" };
  }
  try {
    const response = await fetchImpl(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`AI provider HTTP ${response.status}`);
    await response.json();
    return {
      sourceNote: `${fallback.sourceNote} 服务端模型：${provider}/${model} 已调用；最终事实文本仍由工具结果 deterministic 生成，易变信息以官方接口为准。`
    };
  } catch (error) {
    return {
      sourceNote: `${fallback.sourceNote} 服务端模型调用失败，使用 deterministic Agent fallback：${error instanceof Error ? error.message : "unknown error"}。`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function positiveInteger(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toolCallFromMap(name: string, result: MapProviderMeta, hasData: boolean, summary: string): AiToolCall {
  const fallbackSuffix = result.fallback ? `；fallback：${result.failureReason ?? "provider unavailable"}` : `；provider：${result.provider}`;
  return {
    name,
    status: mapToolStatus(result, hasData),
    summary: `${summary}${fallbackSuffix}`
  };
}

function weatherToolCall(result: WeatherResult): AiToolCall {
  if (result.live) {
    return {
      name: "天气查询",
      status: "success",
      summary: `${result.summary ?? "已返回官方天气"}；provider：${result.provider}`
    };
  }
  return {
    name: "天气查询",
    status: result.fallback ? "skipped" : "failed",
    summary: `未返回官方实时天气；${result.failureReason ?? "天气数据为空"}`
  };
}

function mapToolStatus(result: MapProviderMeta, hasData: boolean): AiToolCall["status"] {
  if (!hasData) return result.fallback ? "skipped" : "failed";
  if (!result.fallback) return "success";
  const reason = result.failureReason ?? "";
  return /not configured|MAP_PROVIDER=fallback/.test(reason) ? "success" : "failed";
}

function poiToCard(poi: NearbyPoi) {
  const meta = [
    poi.category,
    poi.rating !== undefined ? `评分 ${poi.rating}` : "评分未返回",
    poi.distanceMeters !== undefined ? `距定位约 ${formatDistance(poi.distanceMeters)}` : "",
    poi.suitableFor ? `适合 ${poi.suitableFor}` : ""
  ].filter(Boolean);
  return {
    id: poi.id,
    title: poi.name,
    subtitle: `${meta.join(" · ")} · ${poi.address ?? "地址待官方确认"}${poi.source?.provider ? ` · ${poi.source.provider}` : ""}`,
    image: poi.cover,
    actionLabel: poi.name.includes(DEFAULT_TICKET_POI_NAME) ? "查看票务候选" : "加入行程",
    href: poi.name.includes(DEFAULT_TICKET_POI_NAME) ? DEFAULT_TICKET_ROUTE : "/plan"
  };
}

function ticketCard(ticketResult: ReturnType<typeof resolveTicketCandidates>) {
  const product = ticketResult.products[0];
  const slot = ticketResult.slots[0];
  return {
    id: DEFAULT_TICKET_DEMO_POI_ID,
    title: `${ticketResult.poiName ?? "景区"}票务候选`,
    subtitle: `${slot?.time ?? "时段待确认"} · ${product?.name ?? "候选待确认"} · sandbox 非实时库存/价格`,
    href: DEFAULT_TICKET_ROUTE,
    actionLabel: "去确认"
  };
}

function ticketLine(ticketResult: ReturnType<typeof resolveTicketCandidates>) {
  if (!ticketResult.wantsTicket) return "";
  if (ticketResult.products.length > 0 && ticketResult.slots.length > 0) {
    return `方案3：${ticketResult.poiName ?? "景区"}仅返回 sandbox 票务候选，进入订单页前需核对官方票价、库存、开放时间和游客信息；这里不代表真实锁票、支付或核销完成。`;
  }
  return "方案3：当前未返回可用票务候选；请通过官方渠道或实时接口确认票价、库存、预约、核销和支付状态。";
}

function buildSourceNote(
  poiResult: PoiSearchResult,
  routeResult: MapProviderMeta,
  weatherResult: WeatherResult,
  ticketResult: ReturnType<typeof resolveTicketCandidates>
) {
  const providers = Array.from(new Set([poiResult.provider, routeResult.provider, weatherResult.provider])).join("/");
  const fallbackNotes = [poiResult, routeResult, weatherResult]
    .filter((result) => result.fallback)
    .map((result) => result.failureReason)
    .filter(Boolean);
  const ticketNote = ticketResult.wantsTicket
    ? ticketResult.products.length > 0
      ? `票务：${ticketResult.poiName ?? "景区"} sandbox/fallback 候选`
      : "票务：未返回可用候选"
    : "票务：未触发";
  return [
    `服务端 Travel Agent；POI/地图/天气 provider：${providers}；坐标系 GCJ-02；${ticketNote}。`,
    fallbackNotes.length ? `fallback：${fallbackNotes.join(" | ")}。` : "",
    "票价、库存、开放时间、天气、交通状态以官方渠道、官方接口或实时接口为准；未声明支付、锁票或核销完成。"
  ].join("");
}

function confidenceFromTools(toolCalls: AiToolCall[]) {
  const success = toolCalls.filter((tool) => tool.status === "success").length;
  const failed = toolCalls.filter((tool) => tool.status === "failed").length;
  const skipped = toolCalls.filter((tool) => tool.status === "skipped").length;
  return Math.max(0.45, Math.min(0.9, 0.58 + success * 0.07 - failed * 0.08 - skipped * 0.03));
}

function pointFromPoi(poi: Poi): MapPoint {
  return { name: poi.name, lng: poi.lng, lat: poi.lat };
}

function formatPoint(point: MapPoint) {
  return `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
}

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters)) return "距离待确认";
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} 公里`;
  return `${Math.max(0, Math.round(distanceMeters))} 米`;
}
