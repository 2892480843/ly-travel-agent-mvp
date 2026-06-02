import type { AiResponse, Poi } from "../types";
import { chatWithAgent } from "./apiClient";
import { searchPois } from "./poiService";

const TICKET_INTENT_PATTERN = /预约|票|门票|核销|订单|库存|余票|演出|支付/;

export async function askTravelAssistant(input: string): Promise<AiResponse> {
  const query = input.trim();
  const pois = resolvePoiTools(query);

  try {
    return await chatWithAgent(query);
  } catch {
    return fallbackResponse(query, pois, "后端 Agent 不可用，已切换浏览器本地 deterministic fallback。");
  }
}

function resolvePoiTools(query: string) {
  const tags = [
    query.includes("老人") || query.includes("少排队") ? "少排队" : "",
    query.includes("亲子") || query.includes("孩子") ? "亲子" : "",
    query.includes("美食") || query.includes("吃") ? "美食" : ""
  ].filter(Boolean);
  const keyword = query.includes("雷峰塔")
    ? "雷峰塔"
    : query.includes("灵隐")
      ? "灵隐"
      : query.includes("西溪")
        ? "西溪"
        : query.includes("西湖")
          ? "西湖"
          : query.includes("美食") || query.includes("吃")
            ? "美食"
            : "";
  return searchPois({ cityId: "hangzhou", keyword, tags: keyword ? [] : tags, limit: 4 });
}

function fallbackResponse(query: string, pois: Poi[], note: string): AiResponse {
  const wantsTicket = TICKET_INTENT_PATTERN.test(query);
  const supportsTicketFallback = wantsTicket && /雷峰|雷峰塔/.test(query);
  const poiNames = pois.slice(0, 3).map((poi) => poi.name);
  const text = [
    poiNames.length
      ? `方案1：优先参考 ${poiNames.join("、")}，只按本地 POI 候选、评分和标签推荐。`
      : "方案1：暂未命中稳定 POI 候选，请补充具体目的地、同行人群或预算。",
    "方案2：路线、距离、天气和交通状态当前未获得后端地图/天气工具结果，不据此作实时判断；以官方地图、天气或实时接口为准。",
    wantsTicket
      ? supportsTicketFallback
        ? "方案3：雷峰塔仅可展示浏览器本地 sandbox 票务入口，不代表真实票价、库存、锁票、核销或支付完成。"
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
      actionLabel: poi.name.includes("雷峰塔") ? "查看票务候选" : "加入行程",
      href: poi.name.includes("雷峰塔") ? "/ticket/leifeng" : "/plan"
    })).concat(ticketState.supportsTicketFallback ? [{
      id: "ticket-leifeng-fallback",
      title: "雷峰塔票务候选",
      subtitle: "浏览器本地 sandbox 入口 · 非实时票价/库存",
      image: undefined,
      actionLabel: "去确认",
      href: "/ticket/leifeng"
    }] : []),
    toolCalls: [
      { name: "POI 搜索", status: pois.length > 0 ? "success" : "failed", summary: `命中 ${pois.length} 个杭州真实 POI 候选` },
      { name: "路线规划", status: "skipped", summary: "后端地图工具不可用，未返回距离、导航或实时交通" },
      { name: "天气查询", status: "skipped", summary: "后端天气工具不可用，未返回官方实时天气" },
      {
        name: "票务候选",
        status: ticketState.supportsTicketFallback ? "success" : "skipped",
        summary: ticketState.wantsTicket
          ? ticketState.supportsTicketFallback
            ? "仅返回雷峰塔浏览器本地 sandbox 候选；非官方实时库存、价格、核销或支付结果"
            : "未命中已接入的 sandbox 票务点位；以官方渠道为准"
          : "用户未表达票务意图，未查询候选"
      }
    ],
    confidence: pois.length > 0 ? 0.72 : 0.48,
    sourceNote
  };
}
