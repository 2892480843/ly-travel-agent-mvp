import { readFileSync } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { URL } from "node:url";
import type { AiToolCall, City, GeneratedItineraryResponse, MapPoint, Order, Poi, PoiCategory, Role, RouteMode, TimelineItem } from "../src/types";
import { authenticateRequest, clearSession, loginWithRole, requireAuth, setSessionCookie } from "./auth";
import { initializeDatabase } from "./db";
import { createMapProvider, type MapProvider, type MapProviderMeta, type PoiSearchInput, type RouteRequest } from "./mapProvider";
import { assertProductionRuntimeConfig, getConfiguredPaymentProvider, getConfiguredTicketProvider } from "./runtimeConfig";
import {
  applyPaymentStatus,
  cancelPayment,
  confirmTicketLock,
  createMerchant,
  createOrder,
  createPayment,
  decideReview,
  DomainError,
  getAdminMetrics,
  getOrder,
  getPayment,
  getTicketLock,
  getTicketOptions,
  listMerchants,
  listOrders,
  listReviews,
  lockTickets,
  recordMapProviderLog,
  recordOperation,
  recordWebhook,
  renderOperationArtifact,
  refundPayment,
  releaseTicketLock,
  syncMerchantInventory,
  verifyVoucher
} from "./repositories";
import { runTravelAgent } from "./travelAgent";
import { streamAgentChat } from "./agentRuntime";
import type { AgentDeps } from "./agentTools";
import { getOrCreateConversation, listUiMessages } from "./conversationStore";
import { DEFAULT_CITY_CENTER, DEFAULT_CITY_ID, DEFAULT_TICKET_DEMO_POI_ID, DEFAULT_TICKET_POI_NAME } from "./config/city";

const root = process.cwd();
loadLocalEnv(root);
assertProductionRuntimeConfig();

const port = Number(process.env.PORT ?? 8787);
const pois = readJson<Poi[]>("poi-data/usable-pois.json");
const cityDoc = readJson<{ cities: City[] }>("poi-data/china-prefecture-cities.json");
const mapProvider = createMapProvider({ pois, cities: cityDoc.cities });
const loggedMapProvider = createLoggedMapProvider(mapProvider);
const agentDeps: AgentDeps = {
  mapProvider: loggedMapProvider,
  getTicketOptions,
  generateItinerary: (input) => generateItineraryPlan(input)
};

initializeDatabase();

const server = http.createServer(async (request, response) => {
  setCors(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const auth = authenticateRequest(request);

    if (request.method === "GET" && url.pathname === "/api/health") {
      // Providers report their REAL operating mode so a live frontend can
      // surface which capabilities are still demo/sandbox.
      sendJson(response, {
        ok: true,
        service: "ly-production-api",
        poiCount: pois.length,
        cityCount: cityDoc.cities.length,
        providers: {
          map: process.env.MAP_PROVIDER === "amap" && process.env.MAP_API_KEY ? "live" : "fallback",
          ai: process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "fallback" && process.env.AI_API_KEY ? "live" : "fallback",
          payment: getConfiguredPaymentProvider() === "sandbox" ? "sandbox" : "live",
          ticket: getConfiguredTicketProvider() === "sandbox" ? "sandbox" : "live"
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody<{ role?: Role; password?: string }>(request);
      const login = loginWithRole(body.role ?? "visitor", body.password ?? "sandbox");
      if (!login) return sendError(response, 401, "Invalid sandbox credentials");
      setSessionCookie(response, login.session.id, login.session.expiresAt);
      sendJson(response, { authenticated: true, user: login.user, expiresAt: login.session.expiresAt });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      sendJson(response, {
        authenticated: auth.authenticated,
        user: auth.user ?? { id: "visitor", name: "游客小陈", role: "visitor" }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      clearSession(response, auth.sessionId);
      sendJson(response, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/pois") {
      // Real provider data when MAP_API_KEY is configured; the provider
      // falls back to the curated local dataset on its own otherwise.
      const result = await loggedMapProvider.searchPois(mapSearchInput(url));
      sendJson(response, result.items);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/pois/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/pois/", ""));
      const poi = pois.find((item) => item.id === id);
      if (!poi) return sendError(response, 404, "POI not found");
      sendJson(response, poi);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/cities") {
      sendJson(response, cityDoc.cities);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/itineraries/generate") {
      const body = await readBody<{ days?: number; preferences?: string[]; cityId?: string; stops?: MapPoint[] }>(request);
      sendJson(response, await generateItineraryPlan(body));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/agent/chat") {
      const body = await readBody<{ input?: string }>(request);
      sendJson(response, await runTravelAgent(body.input ?? "", {
        mapProvider: loggedMapProvider,
        getTicketOptions
      }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/agent/chat/stream") {
      const body = await readBody<{ input?: string; conversationId?: string; newConversation?: boolean }>(request);
      const inputText = (body.input ?? "").trim();
      if (!inputText) return sendError(response, 400, "input is required");
      const clientAbort = new AbortController();
      request.on("close", () => clientAbort.abort());
      await streamAgentChat({
        text: inputText,
        ctx: {
          userId: auth.user?.id ?? "visitor",
          conversationId: body.conversationId,
          newConversation: body.newConversation,
          abortSignal: clientAbort.signal
        },
        deps: agentDeps,
        response
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/agent/conversations/latest") {
      const userId = auth.user?.id ?? "visitor";
      const conversation = getOrCreateConversation(userId);
      sendJson(response, { conversationId: conversation.id, title: conversation.title, messages: listUiMessages(conversation.id) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/agent/conversations") {
      const userId = auth.user?.id ?? "visitor";
      const conversation = getOrCreateConversation(userId, undefined, true);
      sendJson(response, { conversationId: conversation.id }, 201);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tickets/options") {
      const poiId = url.searchParams.get("poiId") ?? DEFAULT_TICKET_DEMO_POI_ID;
      const visitDate = url.searchParams.get("visitDate") ?? undefined;
      sendJson(response, getTicketOptions(poiId, visitDate));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tickets/lock") {
      const denied = requireAuth(auth, "tickets:lock");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ productId?: string; ticketId?: string; slotId: string; visitDate: string; quantity: number }>(request);
      sendJson(response, lockTickets({
        productId: body.productId ?? body.ticketId ?? "",
        slotId: body.slotId,
        visitDate: body.visitDate,
        quantity: body.quantity
      }, auth.user!), 201);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tickets/release") {
      const denied = requireAuth(auth, "tickets:lock");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ lockId: string }>(request);
      sendJson(response, releaseTicketLock(body.lockId, auth.user!));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tickets/confirm") {
      const denied = requireAuth(auth, "admin:read");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ lockId: string; orderId: string }>(request);
      sendJson(response, confirmTicketLock(body, auth.user!));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tickets/verify") {
      const denied = requireAuth(auth, "tickets:verify");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ voucherCode: string; visitDate?: string; slotId?: string }>(request);
      sendJson(response, verifyVoucher(body, auth.user!));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/tickets/locks/")) {
      const denied = requireAuth(auth, "tickets:lock");
      if (denied) return sendError(response, denied.status, denied.message);
      const id = decodeURIComponent(url.pathname.replace("/api/tickets/locks/", ""));
      sendJson(response, getTicketLock(id));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      const denied = requireAuth(auth, "orders:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<Omit<Order, "id" | "createdAt" | "updatedAt" | "status" | "paymentProvider"> & { lockId?: string }>(request);
      sendJson(response, createOrder(body, auth.user!), 201);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/orders") {
      const denied = requireAuth(auth, "orders:own");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, listOrders(auth.user!));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/orders/")) {
      const denied = requireAuth(auth, "orders:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const id = decodeURIComponent(url.pathname.replace("/api/orders/", ""));
      sendJson(response, getOrder(id));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/payments/create") {
      const denied = requireAuth(auth, "payments:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ orderId: string; provider?: string }>(request);
      sendJson(response, createPayment(body, auth.user!), 201);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/payments/cancel") {
      const denied = requireAuth(auth, "payments:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ paymentId: string }>(request);
      sendJson(response, cancelPayment(body.paymentId, auth.user!));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/payments/refund") {
      const denied = requireAuth(auth, "payments:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ paymentId: string }>(request);
      sendJson(response, refundPayment(body.paymentId, auth.user!));
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/payments/webhook/")) {
      const provider = decodeURIComponent(url.pathname.replace("/api/payments/webhook/", ""));
      const body = await readBody<{ eventId?: string; paymentId: string; status: "paid" | "failed" | "expired" | "cancelled" | "refunded"; signature?: string; payload?: unknown }>(request);
      sendJson(response, recordWebhook(provider, body, auth.user));
      return;
    }

    const sandboxPaymentMatch = url.pathname.match(/^\/api\/payments\/([^/]+)\/sandbox$/);
    if (request.method === "POST" && sandboxPaymentMatch) {
      const denied = requireAuth(auth, "payments:own");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ status?: "paid" | "failed" | "expired" }>(request);
      sendJson(response, applyPaymentStatus(decodeURIComponent(sandboxPaymentMatch[1]), body.status ?? "paid", auth.user!, "sandbox"));
      return;
    }

    const paymentMatch = url.pathname.match(/^\/api\/payments\/([^/]+)$/);
    if (request.method === "GET" && paymentMatch) {
      const denied = requireAuth(auth, "payments:own");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, getPayment(decodeURIComponent(paymentMatch[1])));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/metrics") {
      const denied = requireAuth(auth, "admin:read");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, getAdminMetrics({
        keyword: url.searchParams.get("keyword") ?? undefined,
        scenic: url.searchParams.get("scenic") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        date: url.searchParams.get("date") ?? undefined
      }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/merchants") {
      const denied = requireAuth(auth, "admin:read");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, listMerchants());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/merchants") {
      const denied = requireAuth(auth, "merchants:write");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, createMerchant(await readBody<{ name: string; category: string; phone?: string; desc?: string }>(request), auth.user!), 201);
      return;
    }

    const merchantSyncMatch = url.pathname.match(/^\/api\/admin\/merchants\/([^/]+)\/sync$/);
    if (request.method === "POST" && merchantSyncMatch) {
      const denied = requireAuth(auth, "merchants:write");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, syncMerchantInventory(decodeURIComponent(merchantSyncMatch[1]), auth.user!));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/reviews") {
      const denied = requireAuth(auth, "admin:read");
      if (denied) return sendError(response, denied.status, denied.message);
      sendJson(response, listReviews());
      return;
    }

    const reviewDecisionMatch = url.pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/decision$/);
    if (request.method === "POST" && reviewDecisionMatch) {
      const denied = requireAuth(auth, "reviews:write");
      if (denied) return sendError(response, denied.status, denied.message);
      const body = await readBody<{ status: "已通过" | "已驳回" | "转人工复核"; remark?: string }>(request);
      sendJson(response, decideReview(decodeURIComponent(reviewDecisionMatch[1]), body.status, body.remark ?? "", auth.user!));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/maps/pois/nearby") {
      sendJson(response, await loggedMapProvider.searchPois(mapSearchInput(url)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/maps/route") {
      sendJson(response, await loggedMapProvider.route(await readBody<RouteRequest>(request)));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/maps/geocode") {
      const body = await readBody<{ keyword: string; cityId?: string }>(request);
      sendJson(response, await loggedMapProvider.geocode({ keyword: body.keyword, cityId: body.cityId }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/maps/reverse-geocode") {
      const body = await readBody<{ lng: number; lat: number; cityId?: string }>(request);
      sendJson(response, await loggedMapProvider.reverseGeocode({ lng: body.lng, lat: body.lat, cityId: body.cityId }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/operations") {
      const body = await readBody<{ scope?: "visitor" | "admin" | "merchant" | "system"; type?: string; label?: string; metadata?: unknown }>(request);
      sendJson(response, recordOperation(body, auth.user), 201);
      return;
    }

    const operationDownloadMatch = url.pathname.match(/^\/api\/operations\/([^/]+)\/download$/);
    if (request.method === "GET" && operationDownloadMatch) {
      const artifact = renderOperationArtifact(decodeURIComponent(operationDownloadMatch[1]));
      sendText(response, artifact.body, artifact.contentType, artifact.filename);
      return;
    }

    sendError(response, 404, "Route not found");
  } catch (error) {
    if (error instanceof DomainError) {
      sendError(response, error.status, error.message, error.code);
      return;
    }
    sendError(response, 500, error instanceof Error ? error.message : "Internal error");
  }
});

server.listen(port, () => {
  console.log(`ly-production-api listening on http://localhost:${port}`);
  // Config summary so a stale process / unloaded .env is obvious at startup.
  const aiProvider = process.env.AI_PROVIDER || "fallback";
  const mapProvider = process.env.MAP_PROVIDER || "fallback";
  console.log(`[config] AI:  provider=${aiProvider} model=${process.env.AI_MODEL || "demo-local"} key=${process.env.AI_API_KEY ? "set" : "MISSING"}`);
  console.log(`[config] Map: provider=${mapProvider} key=${process.env.MAP_API_KEY ? "set" : "MISSING"}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[fatal] 端口 ${port} 已被占用：可能有旧的后端进程仍在运行（其配置可能是过期的）。`);
    console.error(`        Windows 查占用：Get-NetTCPConnection -LocalPort ${port} -State Listen | % { Get-Process -Id $_.OwningProcess }`);
    process.exit(1);
  }
  throw error;
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8")) as T;
}

function loadLocalEnv(cwd: string) {
  try {
    const content = readFileSync(join(cwd, ".env"), "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
      if (!match) return;
      const [, key, rawValue] = match;
      // Real (non-empty) process env wins; an empty string counts as unset
      // so a stray `set AI_PROVIDER=` cannot mask the .env value.
      if (process.env[key] !== undefined && process.env[key] !== "") return;
      process.env[key] = unquoteEnvValue(rawValue);
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function unquoteEnvValue(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  const commentIndex = trimmed.indexOf(" #");
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

async function generateItineraryPlan(input: { days?: number; preferences?: string[]; cityId?: string; stops?: MapPoint[] }): Promise<GeneratedItineraryResponse> {
  const cityId = input.cityId ?? DEFAULT_CITY_ID;
  const days = clampInteger(input.days ?? 3, 1, 5);
  const preferences = normalizeItineraryPreferences(input.preferences);
  const cityPois = pois.filter((poi) => poi.cityId === cityId);

  // Three-tier POI sourcing: caller-pinned stops (assistant/map handover)
  // > live provider search by preference > curated local dataset.
  const pinnedStops = (input.stops ?? [])
    .filter((stop) => Number.isFinite(stop?.lng) && Number.isFinite(stop?.lat))
    .slice(0, 15);
  let selectedPois: Poi[];
  let poiSourceSummary: string;
  if (pinnedStops.length >= 2) {
    selectedPois = pinnedStops.map((stop, index) => pinnedStopToPoi(stop, index, cityId));
    poiSourceSummary = `按调用方传入的 ${selectedPois.length} 个地点编排（AI 助手/导览联动）`;
  } else {
    const livePois = await searchLiveItineraryPois(preferences, cityId, days * 3);
    if (livePois.length >= 3) {
      selectedPois = livePois;
      poiSourceSummary = `地图 provider 实时检索 ${livePois.length} 个候选，偏好：${preferences.join("、")}`;
    } else {
      selectedPois = selectItineraryPois(cityPois, preferences, days * 3);
      poiSourceSummary = `provider 不可用，本地精选数据集兜底 ${selectedPois.length} 个候选`;
    }
  }
  const routeResult = await loggedMapProvider.route({
    cityId,
    mode: walkingMode(preferences),
    origin: pointFromPoi(selectedPois[0]),
    destination: pointFromPoi(selectedPois[Math.min(selectedPois.length - 1, days * 2)]),
    waypoints: selectedPois.slice(1, Math.min(selectedPois.length - 1, 5)).map(pointFromPoi).filter(isMapPoint),
    preferences
  });
  const weatherResult = await loggedMapProvider.weather({ cityId });
  const ticketOptions = getTicketOptions(DEFAULT_TICKET_DEMO_POI_ID);
  const toolCalls: AiToolCall[] = [
    {
      name: "POI 候选编排",
      status: selectedPois.length ? "success" : "failed",
      summary: poiSourceSummary
    },
    {
      name: "路线约束",
      status: routeResult.fallback ? "skipped" : "success",
      summary: `${routeResult.mode} · ${routeResult.distanceMeters} 米 · 约 ${routeResult.durationMinutes} 分钟；provider：${routeResult.provider}${routeResult.fallback ? `；fallback：${routeResult.failureReason ?? "provider unavailable"}` : ""}`
    },
    {
      name: "天气约束",
      status: weatherResult.live ? "success" : "skipped",
      summary: weatherResult.live ? `${weatherResult.summary ?? "已返回天气"}；provider：${weatherResult.provider}` : `未返回官方实时天气；${weatherResult.failureReason ?? "使用本地舒适天气假设"}`
    },
    {
      name: "票务候选",
      status: ticketOptions.products.length && ticketOptions.slots.length ? "success" : "skipped",
      summary: `${DEFAULT_TICKET_POI_NAME} sandbox 候选 ${ticketOptions.products.length} 类票、${ticketOptions.slots.length} 个时段；非官方实时库存或支付结果`
    }
  ];
  const totalPerPerson = 1600 + days * 360 + (preferences.includes("挑战") ? 120 : 0);

  return {
    cityId,
    days,
    nights: Math.max(days - 1, 0),
    title: `${cityName(cityId)} ${days}日${Math.max(days - 1, 0)}晚 ${itineraryTheme(preferences)}`,
    preferences,
    summary: [
      `可步行比例 ${walkingRatio(preferences)}%`,
      `热门点错峰 ${Math.min(days + 1, selectedPois.length)} 处`,
      `亲子休息点 ${preferences.includes("亲子游") ? days + 2 : days} 个`,
      `票务可预约 ${ticketOptions.products.length} 项`
    ],
    reasons: buildItineraryReasons(selectedPois, preferences),
    constraints: [
      { label: "出行天数", value: `${days}天`, status: "通过", tone: "green" },
      { label: "预算", value: `约 ￥${totalPerPerson.toLocaleString()} / 人`, status: totalPerPerson <= 3000 ? "通过" : "提醒", tone: totalPerPerson <= 3000 ? "green" : "orange" },
      { label: "同行", value: "2 位成人 · 1 位儿童", status: "通过", tone: "green" },
      { label: "步行强度", value: preferences.find((item) => ["轻松", "适中", "挑战"].includes(item)) ?? "适中", status: "通过", tone: "green" },
      { label: "数据来源", value: "真实 POI + 地图/票务工具", status: "通过", tone: "green" }
    ],
    budget: {
      totalPerPerson,
      days,
      breakdown: [
        { name: "住宿", value: 44, fill: "#6fa88a" },
        { name: "门票", value: 24, fill: "#d8b96a" },
        { name: "餐饮", value: 20, fill: "#c9975d" },
        { name: "交通", value: 12, fill: "#7ba7c8" }
      ]
    },
    items: buildItineraryItems(selectedPois, days, preferences, weatherResult.summary, cityId),
    sourceNote: `服务端 Itinerary Agent 已编排 POI、路线、天气和 sandbox 票务候选；${routeResult.fallback || !weatherResult.live ? "部分工具为 fallback，" : ""}易变信息以官方渠道为准。`,
    toolCalls,
    // Stops handover for the map page (智能导览跨页联动): flat list for
    // single-day consumers plus per-day groups (same day split as the
    // timeline) so multi-day plans can be toured day by day.
    mapStops: selectedPois.slice(0, 8)
      .filter((poi) => Number.isFinite(poi.lng) && Number.isFinite(poi.lat))
      .map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat })),
    mapStopsByDay: Array.from({ length: days }, (_, dayIndex) => ({
      day: `Day ${dayIndex + 1}`,
      stops: selectedPois.slice(dayIndex * 3, dayIndex * 3 + 3)
        .filter((poi) => Number.isFinite(poi.lng) && Number.isFinite(poi.lat))
        .map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }))
    })).filter((group) => group.stops.length >= 1)
  };
}

// Mixes one live provider search per preferred category (throttled and
// cached inside the provider), interleaving results so each day gets a
// blend instead of three of the same kind.
async function searchLiveItineraryPois(preferences: string[], cityId: string, limit: number): Promise<Poi[]> {
  const categories: PoiCategory[] = [];
  if (preferences.some((item) => item.includes("历史") || item.includes("文化"))) categories.push("文化艺术");
  if (preferences.some((item) => item.includes("自然") || item.includes("风光"))) categories.push("公园自然");
  if (preferences.some((item) => item.includes("美食"))) categories.push("美食");
  if (preferences.some((item) => item.includes("亲子"))) categories.push("亲子游");
  if (!categories.includes("景点")) categories.unshift("景点");
  try {
    const results = await Promise.all(categories.map((category) =>
      loggedMapProvider.searchPois({
        cityId,
        category,
        lng: DEFAULT_CITY_CENTER.lng,
        lat: DEFAULT_CITY_CENTER.lat,
        radius: 12000,
        limit: Math.max(3, Math.ceil(limit / categories.length))
      })
    ));
    const lists = results.map((result) => result.items);
    const merged: Poi[] = [];
    const seen = new Set<string>();
    for (let index = 0; merged.length < limit && lists.some((list) => index < list.length); index += 1) {
      for (const list of lists) {
        const poi = list[index];
        if (poi && !seen.has(poi.id) && merged.length < limit) {
          seen.add(poi.id);
          merged.push(poi);
        }
      }
    }
    return merged;
  } catch {
    return [];
  }
}

function pinnedStopToPoi(stop: MapPoint, index: number, cityId: string): Poi {
  return {
    id: `pinned-${index}`,
    name: stop.name ?? `地点 ${index + 1}`,
    cityId,
    category: "景点",
    tags: ["联动地点"],
    lng: stop.lng,
    lat: stop.lat,
    coordinateSystem: "GCJ-02"
  };
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function normalizeItineraryPreferences(preferences: string[] | undefined) {
  const normalized = (preferences?.length ? preferences : ["历史文化", "亲子游", "适中"])
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function selectItineraryPois(cityPois: Poi[], preferences: string[], limit: number) {
  const preferred = cityPois
    .map((poi) => ({ poi, score: scoreItineraryPoi(poi, preferences) }))
    .sort((left, right) => right.score - left.score || (right.poi.rating ?? 0) - (left.poi.rating ?? 0))
    .map((entry) => entry.poi);
  const firstPass = diversifyPois(preferred, limit);
  if (firstPass.length >= limit) return firstPass;
  const used = new Set(firstPass.map((poi) => poi.id));
  return [...firstPass, ...preferred.filter((poi) => !used.has(poi.id))].slice(0, limit);
}

function scoreItineraryPoi(poi: Poi, preferences: string[]) {
  const text = normalizeSearchText([poi.name, poi.category, poi.address, poi.description, poi.suitableFor, ...poi.tags]);
  const ratingScore = Math.round((poi.rating ?? 4) * 10);
  const preferenceScore = preferences.reduce((score, preference) => {
    const keyword = normalizeSearchText([preference]);
    if (text.includes(keyword)) return score + 18;
    if (preference.includes("历史") && /历史|文化|博物馆|遗迹|名胜/.test(text)) return score + 14;
    if (preference.includes("亲子") && /亲子|儿童|家庭|动物园|公园/.test(text)) return score + 14;
    if (preference.includes("美食") && /美食|餐饮|小吃|咖啡|餐厅/.test(text)) return score + 14;
    if (preference.includes("自然") && /自然|公园|江滩|湖|风景/.test(text)) return score + 12;
    return score;
  }, 0);
  const categoryScore = poi.category === "景点" || poi.category === "文化艺术" ? 10 : poi.category === "美食" ? 7 : 4;
  return ratingScore + preferenceScore + categoryScore;
}

function diversifyPois(candidates: Poi[], limit: number) {
  const result: Poi[] = [];
  const categoryCounts = new Map<string, number>();
  candidates.forEach((poi) => {
    if (result.length >= limit) return;
    const count = categoryCounts.get(poi.category) ?? 0;
    if (count >= Math.max(2, Math.ceil(limit / 4))) return;
    result.push(poi);
    categoryCounts.set(poi.category, count + 1);
  });
  return result;
}

function buildItineraryItems(selectedPois: Poi[], days: number, preferences: string[], weatherSummary: string | undefined, cityId: string) {
  const slots = ["09:30-11:00", "11:20-12:20", "13:50-15:20"];
  const items: GeneratedItineraryResponse["items"] = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = `Day ${dayIndex + 1}`;
    items.push({
      day,
      time: "09:00",
      title: dayIndex === 0 ? "酒店出发" : "酒店出发 / 当日路线确认",
      subtitle: `${cityName(cityId)}当日行程由服务端 Agent 根据偏好、天气、路线和票务候选生成。`,
      type: "hotel",
      tags: ["Agent生成", preferences.includes("亲子游") ? "亲子节奏" : "同行偏好"],
      meta: weatherSummary ?? "天气待确认",
      traffic: walkingMode(preferences) === "walking" ? "步行优先" : "交通优先"
    });

    selectedPois.slice(dayIndex * 3, dayIndex * 3 + 3).forEach((poi, slotIndex) => {
      items.push(itineraryItemFromPoi(poi, day, slots[slotIndex] ?? `${10 + slotIndex}:00`, slotIndex, preferences));
    });
  }
  return items;
}

function itineraryItemFromPoi(poi: Poi, day: string, time: string, index: number, preferences: string[]): GeneratedItineraryResponse["items"][number] {
  const type = timelineTypeFromPoi(poi);
  return {
    day,
    time,
    title: poi.name,
    subtitle: itinerarySubtitle(poi, index, preferences),
    image: poi.cover,
    type,
    tags: uniqueStrings([poi.category, ...poi.tags]).slice(0, 3),
    meta: poi.suggestedDuration ?? (type === "food" ? "60分钟" : "90分钟"),
    open: compactOpeningHours(poi.openingHours),
    traffic: index === 0 ? "错峰优先" : "顺路衔接",
    poiId: poi.id,
    note: `${poi.category} · ${poi.address ?? "地址待确认"}`
  };
}

function itinerarySubtitle(poi: Poi, index: number, preferences: string[]) {
  const base = poi.description || poi.address || "基于真实 POI 候选纳入当日路线。";
  const prefix = index === 0 ? "上午优先安排，降低热门时段排队风险" : index === 1 ? "保留休息与换乘缓冲" : "下午衔接同区域点位";
  const preference = preferences.includes("亲子游") ? "，兼顾亲子节奏" : preferences.includes("美食体验") ? "，兼顾本地体验" : "";
  return `${prefix}${preference}。${base}`.slice(0, 82);
}

function timelineTypeFromPoi(poi: Poi): TimelineItem["type"] {
  if (poi.category === "美食") return "food";
  return "spot";
}

function compactOpeningHours(openingHours: string | undefined) {
  if (!openingHours) return undefined;
  return openingHours.replace(/\s+/g, " ").slice(0, 22);
}

function buildItineraryReasons(selectedPois: Poi[], preferences: string[]) {
  const topNames = selectedPois.slice(0, 3).map((poi) => poi.name).join("、") || "核心点位";
  return [
    `${topNames} 等候选来自真实 POI 数据集，优先匹配 ${preferences.join("、")}`,
    "按上午热门点、午间休息点、下午同区域衔接组织节奏",
    "结合地图路线与天气工具状态生成，不把 fallback 当作官方实时结论",
    "黄鹤楼票务只展示 sandbox 候选，不宣称真实库存或支付成功"
  ];
}

function itineraryTheme(preferences: string[]) {
  if (preferences.includes("亲子游")) return "亲子文化深度游";
  if (preferences.includes("美食体验")) return "江城美食文化游";
  if (preferences.includes("自然风光")) return "城市风光慢游";
  return "文化深度游";
}

function walkingRatio(preferences: string[]) {
  if (preferences.includes("轻松")) return 72;
  if (preferences.includes("挑战")) return 58;
  return 64;
}

function walkingMode(preferences: string[]): RouteMode {
  return preferences.includes("挑战") ? "walking" : "transit";
}

function cityName(cityId: string) {
  return cityDoc.cities.find((city) => city.id === cityId)?.name ?? "武汉";
}

function pointFromPoi(poi: Poi | undefined): MapPoint | undefined {
  if (!poi) return undefined;
  return { name: poi.name, lng: poi.lng, lat: poi.lat };
}

function isMapPoint(point: MapPoint | undefined): point is MapPoint {
  return Boolean(point);
}

function normalizeSearchText(values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mapSearchInput(url: URL): PoiSearchInput {
  const lngParam = url.searchParams.get("lng");
  const latParam = url.searchParams.get("lat");
  const lng = lngParam === null ? Number.NaN : Number(lngParam);
  const lat = latParam === null ? Number.NaN : Number(latParam);
  const input: PoiSearchInput = {
    keyword: url.searchParams.get("keyword") ?? undefined,
    cityId: url.searchParams.get("cityId") ?? DEFAULT_CITY_ID,
    category: url.searchParams.get("category") as PoiCategory | undefined,
    limit: Number(url.searchParams.get("limit") ?? 10),
    radius: Number(url.searchParams.get("radius") ?? 3000)
  };
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    input.lng = lng;
    input.lat = lat;
  }
  return input;
}

function createLoggedMapProvider(provider: MapProvider): MapProvider {
  return {
    async searchPois(input) {
      return logMapProviderResult("pois.search", input, await provider.searchPois(input));
    },
    async route(input) {
      return logMapProviderResult("route", input, await provider.route(input));
    },
    async geocode(input) {
      return logMapProviderResult("geocode", input, await provider.geocode(input));
    },
    async reverseGeocode(input) {
      return logMapProviderResult("reverse-geocode", input, await provider.reverseGeocode(input));
    },
    async weather(input) {
      return logMapProviderResult("weather", input, await provider.weather(input));
    }
  };
}

function logMapProviderResult<T extends MapProviderMeta>(action: string, request: unknown, result: T): T {
  recordMapProviderLog(result.provider, action, result.fallback ? "fallback" : "success", request, result);
  return result;
}

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function sendJson(response: ServerResponse, data: unknown, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendText(response: ServerResponse, body: string, contentType: string, filename?: string, status = 200) {
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (filename) headers["Content-Disposition"] = `attachment; filename="${filename.replace(/"/g, "")}"`;
  response.writeHead(status, headers);
  response.end(body);
}

function sendError(response: ServerResponse, status: number, message: string, code = "error") {
  sendJson(response, { error: message, code }, status);
}

async function readBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as T : {} as T;
}
