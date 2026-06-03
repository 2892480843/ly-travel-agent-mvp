import { kpis } from "../data/mockData";
import type { AdminMetrics, AdminMetricsFilter, AiResponse, City, GeneratedItineraryResponse, MapPoint, OperationResult, OperationScope, Order, PaymentRecord, Poi, PoiSearchParams, RouteMode, RouteResult, TicketLock, TicketProduct, TicketSlot } from "../types";
import { DEFAULT_CITY_ID, DEFAULT_TICKET_DEMO_POI_ID } from "../config/city";
import { getCities, getFeaturedPois, getPoiById, searchPois } from "./poiService";
import { getDemoTicketOptions, getDemoTicketSlots } from "./ticketService";
import { getCurrentUser, loginAsRole } from "./authService";
import { readOrders } from "./orderService";

const API_BASE = normalizeLocalApiBase(import.meta.env.VITE_API_BASE_URL ?? "");
const PAYMENT_PROVIDER = import.meta.env.VITE_PAYMENT_PROVIDER?.trim() || "sandbox";

export function apiUrl(path: string) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function normalizeLocalApiBase(base: string) {
  if (!base || typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    return base;
  }
  return base;
}

async function request<T>(path: string, options?: RequestInit, retryAuth = true): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {})
      },
      signal: controller.signal
    });
    if (response.status === 401 && retryAuth) {
      await loginAsRole(getCurrentUser().role);
      return await request<T>(path, options, false);
    }
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
  try {
    return await request<TicketLock>("/api/tickets/lock", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch {
    const now = new Date().toISOString();
    return {
      id: `MOCKLOCK${Date.now()}`,
      productId: payload.productId,
      slotId: payload.slotId,
      visitDate: payload.visitDate,
      quantity: payload.quantity,
      status: "active",
      userId: getCurrentUser().id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now
    };
  }
}

export async function releaseTicketLock(lockId: string): Promise<TicketLock> {
  try {
    return await request<TicketLock>("/api/tickets/release", {
      method: "POST",
      body: JSON.stringify({ lockId })
    });
  } catch {
    const now = new Date().toISOString();
    return {
      id: lockId,
      productId: "local-fallback",
      slotId: "local-fallback",
      visitDate: now.slice(0, 10),
      quantity: 0,
      status: "released",
      userId: getCurrentUser().id,
      expiresAt: now,
      createdAt: now,
      updatedAt: now
    };
  }
}

export async function verifyTicketVoucher(payload: { voucherCode: string; visitDate?: string; slotId?: string }) {
  return await request<{ id: string; orderId: string; code: string; status: string; verifiedAt?: string }>("/api/tickets/verify", {
    method: "POST",
    body: JSON.stringify(payload)
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
    return readOrders();
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

export async function generateItinerary(payload: { days?: number; preferences?: string[]; cityId?: string }): Promise<GeneratedItineraryResponse> {
  return await request<GeneratedItineraryResponse>("/api/itineraries/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminMetrics(filters: AdminMetricsFilter = {}): Promise<AdminMetrics> {
  const query = new URLSearchParams();
  if (filters.keyword?.trim()) query.set("keyword", filters.keyword.trim());
  if (filters.scenic && filters.scenic !== "全部景区") query.set("scenic", filters.scenic);
  if (filters.status && filters.status !== "全部状态") query.set("status", filters.status);
  if (filters.date) query.set("date", filters.date);
  const path = `/api/admin/metrics${query.toString() ? `?${query.toString()}` : ""}`;
  try {
    return await request<AdminMetrics>(path);
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
        ["停车场位置", "2,915", "12.07%", "+1.84%"],
        ["天气查询", "2,104", "8.72%", "-3.12%"],
        ["景点介绍", "1,876", "7.77%", "+2.05%"]
      ],
      scopeLabel: "全部关键词 / 全部景区 / 全部状态",
      sourceNote: "本地兜底：静态演示指标；服务端可用时统计 orders、ticket_locks、review_records。"
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

export async function recordOperation(payload: { scope?: OperationScope; type?: string; label: string; metadata?: unknown }): Promise<OperationResult> {
  try {
    return await request<OperationResult>("/api/operations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch {
    const now = new Date().toISOString();
    return {
      id: `local-${Date.now()}`,
      scope: payload.scope ?? "visitor",
      type: payload.type ?? "ui.action",
      label: payload.label,
      status: "completed",
      message: fallbackOperationMessage(payload.label, payload.type ?? "ui.action"),
      createdAt: now
    };
  }
}

function fallbackOperationMessage(label: string, type: string) {
  if (type.includes("export")) return `${label}已生成，可下载演示数据文件。`;
  if (type.includes("report")) return `${label}已生成运营日报草稿。`;
  if (type.includes("batch")) return `${label}已进入批量处理队列。`;
  if (type.includes("workflow.publish")) return `${label}已发布到演示工作流配置。`;
  if (type.includes("knowledge.reindex")) return `${label}已进入知识库索引重建队列。`;
  if (type.includes("create")) return `${label}入口已打开，请继续补充信息。`;
  if (type.includes("save")) return `${label}已保存为当前草稿。`;
  if (type.includes("preview")) return `${label}已打开预览入口。`;
  if (type.includes("merchant.marketing")) return "营销中心入口已打开，可继续配置优惠券、套餐或活动。";
  if (type.includes("traffic.realtime")) return "实时客流视图已打开。";
  if (type.includes("route.reorder")) return "路线已按当前模式重新排序。";
  if (type.includes("favorite")) return "收藏状态已更新。";
  if (type.includes("share")) return "分享面板已准备好。";
  if (type.includes("voice") || type.includes("vision") || type.includes("guide") || type.includes("ar") || type.includes("immersive")) {
    return `${label}入口已打开；当前不会调用真实设备或第三方服务。`;
  }

  const labelMessage = fallbackOperationMessageForLabel(label);
  if (labelMessage) return labelMessage;

  return `${label}已处理完成。`;
}

function fallbackOperationMessageForLabel(label: string) {
  const normalized = label.replace(/\s+/g, "");
  const serviceLabels = new Set(["卫生间", "停车场", "母婴室", "无障碍", "充电宝", "游客中心", "行李寄存", "直通车"]);
  const assistantEntries = new Set(["行程规划", "景点导览", "票务预约", "酒店预订", "交通出行", "美食推荐"]);

  if (normalized.includes("加入清单")) return "已加入行程清单，可在右侧清单查看。";
  if (normalized === "清空") return "清单已清空。";
  if (normalized.includes("编辑偏好") || normalized.includes("调整偏好")) return "偏好调整入口已打开。";
  if (normalized === "预订") return "已加入待确认预订清单。";
  if (normalized.includes("查看更多")) return "更多列表入口已打开。";
  if (normalized.includes("热门景点")) return "已切换到热门景点视图。";
  if (normalized.includes("夜游灯光秀")) return "已切换到夜游灯光秀视图。";
  if (serviceLabels.has(normalized)) return `已在地图中标记${normalized}相关服务点。`;
  if (assistantEntries.has(normalized)) return `${normalized}助手入口已打开。`;
  return "";
}
