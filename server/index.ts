import { readFileSync } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { URL } from "node:url";
import type { City, Order, Poi, PoiCategory, Role } from "../src/types";
import { authenticateRequest, clearSession, loginWithRole, requireAuth, setSessionCookie } from "./auth";
import { initializeDatabase } from "./db";
import { createMapProvider, type MapProvider, type MapProviderMeta, type PoiSearchInput, type RouteRequest } from "./mapProvider";
import { assertProductionRuntimeConfig } from "./runtimeConfig";
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
  recordWebhook,
  refundPayment,
  releaseTicketLock,
  syncMerchantInventory,
  verifyVoucher
} from "./repositories";
import { runTravelAgent } from "./travelAgent";
import { DEFAULT_CITY_ID, DEFAULT_TICKET_DEMO_POI_ID } from "./config/city";

const root = process.cwd();
loadLocalEnv(root);
assertProductionRuntimeConfig();

const port = Number(process.env.PORT ?? 8787);
const pois = readJson<Poi[]>("poi-data/usable-pois.json");
const cityDoc = readJson<{ cities: City[] }>("poi-data/china-prefecture-cities.json");
const mapProvider = createMapProvider({ pois, cities: cityDoc.cities });
const loggedMapProvider = createLoggedMapProvider(mapProvider);

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
      sendJson(response, { ok: true, service: "ly-production-api", poiCount: pois.length, cityCount: cityDoc.cities.length });
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
      sendJson(response, searchPois(url));
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
      const body = await readBody<{ days?: number; preferences?: string[]; cityId?: string }>(request);
      const cityId = body.cityId ?? DEFAULT_CITY_ID;
      const candidates = pois.filter((poi) => poi.cityId === cityId).slice(0, 12);
      sendJson(response, {
        cityId,
        days: Math.min(Math.max(body.days ?? 1, 1), 3),
        preferences: body.preferences ?? ["少排队", "文化体验"],
        items: candidates.slice(0, 6).map((poi, index) => ({
          time: `${9 + index}:00`,
          title: poi.name,
          poiId: poi.id,
          note: `${poi.category} · ${poi.suggestedDuration ?? "1-2 小时"}`
        })),
        sourceNote: "本接口基于真实 POI 候选生成演示行程；交通、天气、票务待后续官方接口接入。"
      });
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
      sendJson(response, getAdminMetrics());
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
      if (process.env[key] !== undefined) return;
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

function searchPois(url: URL) {
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase() ?? "";
  const cityId = url.searchParams.get("cityId") ?? DEFAULT_CITY_ID;
  const category = url.searchParams.get("category") as PoiCategory | null;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 24), 100);

  return pois
    .filter((poi) => {
      const text = [poi.name, poi.address, poi.category, poi.description, ...poi.tags].join(" ").toLowerCase();
      return (!keyword || text.includes(keyword))
        && (!cityId || poi.cityId === cityId)
        && (!category || poi.category === category);
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
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
