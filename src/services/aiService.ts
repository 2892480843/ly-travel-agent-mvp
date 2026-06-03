import type { AiResponse, Poi } from "../types";
import { DEFAULT_CITY_ID, DEFAULT_CITY_NAME, DEFAULT_TICKET_POI_NAME, DEFAULT_TICKET_ROUTE } from "../config/city";
import { chatWithAgent } from "./apiClient";
import { searchPois } from "./poiService";

const TICKET_INTENT_PATTERN = /预约|票|门票|核销|订单|库存|余票|演出|支付/;
const TRAVEL_INTENT_PATTERN = /黄鹤|黄鹤楼|湖北省博物馆|省博|博物馆|江汉关|江滩|汉口江滩|动物园|武汉动物园|东湖|楚河|汉街|户部巷|景点|景区|目的地|旅游|旅行|游玩|游览|出行|行程|路线|攻略|一日游|半日游|好玩|去哪|哪里玩|必去|打卡|逛|citywalk|Citywalk|门票|预约|票|余票|库存|订单|核销|支付|少排队|老人|亲子|孩子|儿童|无障碍|美食|吃|餐厅|小吃|咖啡|茶|夜市|活动|展览|演出|自驾|开车|驾车|公交|地铁|巴士|骑行|单车|自行车|天气|交通|地图|导航/;

export async function askTravelAssistant(input: string): Promise<AiResponse> {
  const query = input.trim();
  if (!hasTravelIntent(query)) {
    return nonTravelClarificationResponse("浏览器本地意图识别未触发后端 Agent；当前仅做意图澄清。");
  }

  const pois = resolvePoiTools(query);

  try {
    return await chatWithAgent(query);
  } catch {
    return fallbackResponse(query, pois, "后端 Agent 不可用，已切换浏览器本地 deterministic fallback。");
  }
}

function hasTravelIntent(query: string) {
  return TRAVEL_INTENT_PATTERN.test(query);
}

function resolvePoiTools(query: string) {
  const tags = [
    query.includes("老人") || query.includes("少排队") ? "少排队" : "",
    query.includes("亲子") || query.includes("孩子") ? "亲子" : "",
    query.includes("美食") || query.includes("吃") ? "美食" : ""
  ].filter(Boolean);
  if (/东湖|楚河|汉街|户部巷/.test(query)) {
    return [];
  }
  const keyword = query.includes("黄鹤楼")
    ? "黄鹤楼"
    : query.includes("湖北省博物馆")
      ? "湖北省博物馆"
      : query.includes("江汉关")
        ? "江汉关"
        : query.includes("江滩")
          ? "江滩"
          : query.includes("亲子") || query.includes("孩子")
            ? "亲子"
            : query.includes("美食") || query.includes("吃")
              ? "美食"
              : "";
  return searchPois({ cityId: DEFAULT_CITY_ID, keyword, tags: keyword ? [] : tags, limit: 4 });
}

function nonTravelClarificationResponse(sourceNote: string): AiResponse {
  return {
    text: "你好，我是武汉文旅助手。请告诉我目的地、同行人群、预算、时间，或是否需要预约票务；我再基于 POI、路线、天气和票务候选给你建议。",
    cards: [],
    toolCalls: [
      { name: "POI 搜索", status: "skipped", summary: "未识别到旅行、地点或票务意图，未执行检索" },
      { name: "路线规划", status: "skipped", summary: "未识别到路线需求，未执行规划" },
      { name: "天气查询", status: "skipped", summary: "未识别到出行或天气需求，未查询天气" },
      { name: "票务候选", status: "skipped", summary: "未表达票务意图，未查询候选" }
    ],
    confidence: 0.36,
    sourceNote
  };
}

function fallbackResponse(query: string, pois: Poi[], note: string): AiResponse {
  const wantsTicket = TICKET_INTENT_PATTERN.test(query);
  const supportsTicketFallback = wantsTicket && /黄鹤|黄鹤楼/.test(query);
  const poiNames = pois.slice(0, 3).map((poi) => poi.name);
  const text = [
    poiNames.length
      ? `方案1：优先参考 ${poiNames.join("、")}，只按本地 POI 候选、评分和标签推荐。`
      : "方案1：暂未命中稳定 POI 候选，请补充具体目的地、同行人群或预算。",
    "方案2：路线、距离、天气和交通状态当前未获得后端地图/天气工具结果，不据此作实时判断；以官方地图、天气或实时接口为准。",
    wantsTicket
      ? supportsTicketFallback
        ? `方案3：${DEFAULT_TICKET_POI_NAME}仅可展示浏览器本地 sandbox 票务入口，不代表真实票价、库存、锁票、核销或支付完成。`
        : "方案3：当前未接入该点位票务工具；请通过官方渠道确认票价、库存、预约、核销和支付状态。"
      : ""
  ].filter(Boolean).join("\n");
  return composeResponse(text, pois, `${note} POI 来自前端本地数据子集；票价、库存、开放时间、天气、交通状态以官方渠道、官方接口或实时接口为准。`, {
    wantsTicket,
    supportsTicketFallback
  });
}

function composeResponse(
  text: string,
  pois: Poi[],
  sourceNote: string,
  ticketState: { wantsTicket: boolean; supportsTicketFallback: boolean }
): AiResponse {
  return {
    text,
    cards: pois.slice(0, ticketState.supportsTicketFallback ? 2 : 3).map((poi) => ({
      id: poi.id,
      title: poi.name,
      subtitle: [
        poi.category,
        poi.rating !== undefined ? `评分 ${poi.rating}` : "评分未返回",
        poi.suitableFor ? `适合 ${poi.suitableFor}` : "",
        poi.address ?? "地址待官方确认"
      ].filter(Boolean).join(" · "),
      image: poi.cover,
      actionLabel: poi.name.includes(DEFAULT_TICKET_POI_NAME) ? "查看票务候选" : "加入行程",
      href: poi.name.includes(DEFAULT_TICKET_POI_NAME) ? DEFAULT_TICKET_ROUTE : "/plan"
    })).concat(ticketState.supportsTicketFallback ? [{
      id: "ticket-yellow-crane-tower-fallback",
      title: `${DEFAULT_TICKET_POI_NAME}票务候选`,
      subtitle: "浏览器本地 sandbox 入口 · 非实时票价/库存",
      image: undefined,
      actionLabel: "去确认",
      href: DEFAULT_TICKET_ROUTE
    }] : []),
    toolCalls: [
      { name: "POI 搜索", status: pois.length > 0 ? "success" : "failed", summary: `命中 ${pois.length} 个${DEFAULT_CITY_NAME}真实 POI 候选` },
      { name: "路线规划", status: "skipped", summary: "后端地图工具不可用，未返回距离、导航或实时交通" },
      { name: "天气查询", status: "skipped", summary: "后端天气工具不可用，未返回官方实时天气" },
      {
        name: "票务候选",
        status: ticketState.supportsTicketFallback ? "success" : "skipped",
        summary: ticketState.wantsTicket
          ? ticketState.supportsTicketFallback
            ? `仅返回${DEFAULT_TICKET_POI_NAME}浏览器本地 sandbox 候选；非官方实时库存、价格、核销或支付结果`
            : "未命中已接入的 sandbox 票务点位；以官方渠道为准"
          : "用户未表达票务意图，未查询候选"
      }
    ],
    confidence: pois.length > 0 ? 0.72 : 0.48,
    sourceNote
  };
}
