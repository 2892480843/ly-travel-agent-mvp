import { kpis } from "../data/mockData";
import type { AdminMetrics, AiResponse, City, MapPoint, Order, PaymentRecord, Poi, PoiSearchParams, RouteMode, RouteResult, TicketLock, TicketProduct, TicketSlot } from "../types";
import { DEFAULT_CITY_ID, DEFAULT_TICKET_DEMO_POI_ID } from "../config/city";
import { getCities, getFeaturedPois, getPoiById, searchPois } from "./poiService";
import { getDemoTicketOptions, getDemoTicketSlots } from "./ticketService";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const PAYMENT_PROVIDER = import.meta.env.VITE_PAYMENT_PROVIDER?.trim() || "sandbox";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("API base URL is not configured");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {})
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Request failed: ${response.status} ${detail}`);
    }
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchPois(params: PoiSearchParams = {}): Promise<Poi[]> {
  const query = new URLSearchParams();
  if (params.keyword) query.set("keyword", params.keyword);
  if (params.cityId) query.set("cityId", params.cityId);
  if (params.category && params.category !== "全部") query.set("category", params.category);
  if (params.limit) query.set("limit", String(params.limit));
  try {
    return await request<Poi[]>(`/api/pois?${query.toString()}`);
  } catch {
    return searchPois(params);
  }
}

export async function fetchPoi(id: string): Promise<Poi | undefined> {
  try {
    return await request<Poi>(`/api/pois/${encodeURIComponent(id)}`);
  } catch {
    return getPoiById(id) ?? getFeaturedPois(DEFAULT_CITY_ID, 1)[0];
  }
}

export async function fetchCities(): Promise<City[]> {
  try {
    return await request<City[]>("/api/cities");
  } catch {
    return getCities();
  }
}

export async function fetchTicketOptions(poiId = DEFAULT_TICKET_DEMO_POI_ID, visitDate?: string): Promise<{ products: TicketProduct[]; slots: TicketSlot[] }> {
  try {
    const query = new URLSearchParams({ poiId });
    if (visitDate) query.set("visitDate", visitDate);
    return await request<{ products: TicketProduct[]; slots: TicketSlot[] }>(`/api/tickets/options?${query.toString()}`);
  } catch {
    return { products: getDemoTicketOptions(poiId), slots: getDemoTicketSlots() };
  }
}

export async function lockTickets(payload: { productId: string; slotId: string; visitDate: string; quantity: number }): Promise<TicketLock> {
  return await request<TicketLock>("/api/tickets/lock", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function releaseTicketLock(lockId: string): Promise<TicketLock> {
  return await request<TicketLock>("/api/tickets/release", {
    method: "POST",
    body: JSON.stringify({ lockId })
  });
}

export async function createOrder(payload: Omit<Order, "id" | "createdAt" | "updatedAt" | "status" | "paymentProvider"> & { lockId?: string }): Promise<Order> {
  try {
    return await request<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch {
    const now = new Date().toISOString();
    return {
      ...payload,
      id: `MOCK${Date.now()}`,
      status: "pending_payment",
      paymentProvider: "mock",
      createdAt: now,
      updatedAt: now
    };
  }
}

export async function fetchOrders(): Promise<Order[]> {
  try {
    return await request<Order[]>("/api/orders");
  } catch {
    return [];
  }
}

export async function createPayment(orderId: string, provider = PAYMENT_PROVIDER): Promise<PaymentRecord> {
  return await request<PaymentRecord>("/api/payments/create", {
    method: "POST",
    body: JSON.stringify({ orderId, provider })
  });
}

export async function fetchPayment(paymentId: string): Promise<PaymentRecord> {
  return await request<PaymentRecord>(`/api/payments/${encodeURIComponent(paymentId)}`);
}

export async function simulateSandboxPayment(paymentId: string, status: "paid" | "failed" | "expired" = "paid"): Promise<PaymentRecord> {
  return await request<PaymentRecord>(`/api/payments/${encodeURIComponent(paymentId)}/sandbox`, {
    method: "POST",
    body: JSON.stringify({ status })
  });
}

export async function fetchRoute(payload: { origin?: MapPoint; destination?: MapPoint; waypoints?: MapPoint[]; mode?: RouteMode; preferences?: string[]; cityId?: string }): Promise<RouteResult> {
  return await request<RouteResult>("/api/maps/route", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function chatWithAgent(input: string): Promise<AiResponse> {
  return await request<AiResponse>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ input })
  });
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  try {
    return await request<AdminMetrics>("/api/admin/metrics");
  } catch {
    return {
      kpis,
      alerts: [
        { title: "拥堵预警", desc: "黄鹤楼与江汉路周边预计 10:00-13:00 进入高峰", level: "高" },
        { title: "库存预警", desc: "黄鹤楼上午 sandbox 票务余量低于演示阈值", level: "中" },
        { title: "设备提醒", desc: "司门口入口闸机 3 号通道离线", level: "低" }
      ],
      hotspots: [
        ["门票预约", "5,842", "24.21%", "+12.35%"],
        ["交通路线", "3,276", "13.57%", "+5.21%"],
        ["停车场位置", "2,915", "12.07%", "+1.84%"]
      ]
    };
  }
}

export type MerchantRow = {
  id: string;
  name: string;
  category: string;
  status: string;
  inventoryStatus: string;
  rating: string;
  orderCount: number;
  reviewStatus: string;
};

export type ReviewRecordRow = {
  id: string;
  subjectName: string;
  submitter: string;
  type: string;
  riskNote: string;
  status: string;
  submittedAt: string;
  reviewedBy?: string;
  remark?: string;
};

export async function fetchMerchants(): Promise<MerchantRow[]> {
  return await request<MerchantRow[]>("/api/admin/merchants");
}

export async function createMerchant(payload: { name: string; category: string; phone?: string; desc?: string }): Promise<MerchantRow> {
  return await request<MerchantRow>("/api/admin/merchants", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function syncMerchantInventory(id: string) {
  return await request<{ ok: boolean; id: string; inventoryStatus: string }>(`/api/admin/merchants/${encodeURIComponent(id)}/sync`, {
    method: "POST"
  });
}

export async function fetchReviews(): Promise<ReviewRecordRow[]> {
  return await request<ReviewRecordRow[]>("/api/admin/reviews");
}

export async function decideReview(id: string, status: "已通过" | "已驳回" | "转人工复核", remark = "") {
  return await request<{ ok: boolean; id: string; status: string; remark: string }>(`/api/admin/reviews/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify({ status, remark })
  });
}
