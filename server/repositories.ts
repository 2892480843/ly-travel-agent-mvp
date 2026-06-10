import { randomUUID } from "node:crypto";
import type { AdminMetrics, AdminMetricsFilter, OperationResult, OperationScope, Order, PaymentRecord, Role, TicketLock, TicketProduct, TicketSlot, TicketVoucher, VisitorInfo } from "../src/types";
import { getDb, withTransaction } from "./db";
import { createPaymentProvider } from "./paymentProvider";
import { getConfiguredPaymentProvider, getConfiguredTicketProvider, isProductionMode } from "./runtimeConfig";
import { createTicketProvider, type TicketProvider } from "./ticketProvider";
import { todayISO } from "./demoDates";

export class DomainError extends Error {
  constructor(public status: number, message: string, public code = "domain_error") {
    super(message);
  }
}

export type AuthUser = {
  id: string;
  name: string;
  role: Role;
};

type TicketProductRow = {
  id: string;
  poi_id: string;
  name: string;
  description: string;
  price: number;
  status: TicketProduct["status"];
  stock: number;
};

type TicketSlotRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: TicketSlot["status"];
  stock: number;
};

type TicketLockRow = {
  id: string;
  product_id: string;
  slot_id: string;
  visit_date: string;
  quantity: number;
  status: TicketLock["status"];
  order_id?: string;
  user_id?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  user_id?: string;
  title: string;
  poi_id: string;
  ticket_id: string;
  ticket_name: string;
  slot_id: string;
  slot_time: string;
  visit_date: string;
  quantity: number;
  amount: number;
  status: Order["status"];
  payment_provider: Order["paymentProvider"];
  lock_id?: string;
  visitor_info_json: string;
  voucher_code?: string;
  image?: string;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  provider: string;
  amount: number;
  status: PaymentRecord["status"];
  external_payment_id?: string;
  checkout_url?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type VoucherRow = {
  id: string;
  order_id: string;
  code: string;
  status: TicketVoucher["status"];
  visit_date: string;
  slot_id: string;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
};

type OperationRecordRow = {
  id: string;
  scope: OperationScope;
  type: string;
  label: string;
  status: OperationResult["status"];
  message: string;
  actor_user_id?: string;
  metadata_json: string;
  created_at: string;
};

type ReviewMetricRow = {
  subject_name: string;
  submitter: string;
  type: string;
  risk_note: string;
  status: string;
  submitted_at: string;
};

type DashboardLockRow = TicketLockRow & {
  poi_id: string;
  product_name: string;
};

export function getUserByRole(role: Role) {
  return getDb().prepare("SELECT id, name, role, password_hash FROM users WHERE role = ?").get(role) as
    | { id: string; name: string; role: Role; password_hash: string }
    | undefined;
}

export function getUserById(id: string) {
  return getDb().prepare("SELECT id, name, role, password_hash FROM users WHERE id = ?").get(id) as
    | { id: string; name: string; role: Role; password_hash: string }
    | undefined;
}

export function getSessionUser(sessionId: string) {
  const now = new Date().toISOString();
  const row = getDb().prepare(`
    SELECT users.id, users.name, users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).get(sessionId, now) as AuthUser | undefined;
  return row;
}

export function createSession(userId: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const id = createId("sess");
  getDb().prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, expires.toISOString(), now.toISOString());
  return { id, expiresAt: expires.toISOString() };
}

export function deleteSession(sessionId: string) {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function getAdminMetrics(filters: AdminMetricsFilter = {}): AdminMetrics {
  const database = getDb();
  const metricFilters = normalizeAdminMetricsFilters(filters);
  const orders = (database.prepare("SELECT * FROM orders").all() as OrderRow[]).filter((row) => orderMatchesMetricFilters(row, metricFilters));
  const locks = (database.prepare(`
    SELECT ticket_locks.*, ticket_products.poi_id, ticket_products.name AS product_name
    FROM ticket_locks
    JOIN ticket_products ON ticket_products.id = ticket_locks.product_id
  `).all() as DashboardLockRow[]).filter((row) => lockMatchesMetricFilters(row, metricFilters));
  const reviews = (database.prepare(`
    SELECT subject_name, submitter, type, risk_note, status, submitted_at
    FROM review_records
  `).all() as ReviewMetricRow[]).filter((row) => reviewMatchesMetricFilters(row, metricFilters));
  const paidOrders = orders.filter((row) => isPaidOrderStatus(row.status));
  const activeLocks = locks.filter((row) => row.status === "active");
  const pendingReviews = reviews.filter((row) => ["待审核", "审核中"].includes(row.status));
  const orderCount = orders.length;
  const paidCount = paidOrders.length;
  const lockCount = activeLocks.length;
  const reviewCount = pendingReviews.length;
  const revenue = paidOrders.reduce((total, row) => total + row.amount, 0);
  const hasFilters = hasAdminMetricsFilters(metricFilters);
  const scopeLabel = adminMetricsScopeLabel(metricFilters);
  return {
    kpis: [
      { label: "今日游客数", value: "36,824", delta: hasFilters ? "演示基准，不参与筛选" : "真实 POI + sandbox", tone: "blue" },
      { label: "订单总数", value: String(orderCount), delta: `已支付 ${paidCount}`, tone: "green" },
      { label: "支付收入", value: `￥${revenue}`, delta: "服务端支付状态", tone: "purple" },
      { label: "活跃锁票", value: String(lockCount), delta: "SQLite 事务锁定", tone: "orange" },
      { label: "待审核", value: String(reviewCount), delta: "审核记录落库", tone: "red" },
      { label: "地图服务", value: process.env.MAP_PROVIDER || "fallback", delta: "provider adapter", tone: "cyan" }
    ],
    alerts: [
      { title: "筛选口径", desc: `${scopeLabel}。筛选作用于订单、锁票、审核记录；游客数为 POI + sandbox 演示基准。`, level: "低" },
      { title: "库存预警", desc: "黄鹤楼 sandbox 候选时段库存低于阈值，锁票失败会明确返回库存不足。", level: "中" },
      { title: "支付沙箱", desc: "未配置真实支付密钥时，支付通过 sandbox provider 模拟。", level: "低" },
      hasFilters && orderCount + lockCount + reviewCount === 0
        ? { title: "无匹配数据", desc: "当前筛选条件下暂无订单、锁票或审核记录匹配。", level: "中" }
        : { title: "地图降级", desc: "未配置地图 key 时返回 fallback 路线和原因。", level: "低" }
    ],
    hotspots: [
      ["订单匹配", String(orderCount), "orders", paidCount ? `已支付 ${paidCount}` : "暂无已支付"],
      ["支付收入", `￥${revenue}`, "paid orders", paidCount ? `${paidCount} 笔` : "暂无支付"],
      ["票务锁定", String(lockCount), "active locks", hasFilters ? "按当前筛选" : "+0"],
      ["审核处理", String(reviewCount), "pending reviews", hasFilters ? "按当前筛选" : "+0"],
      ["筛选口径", hasFilters ? "已应用" : "全量", "scope", scopeLabel]
    ],
    scopeLabel,
    sourceNote: "服务端统计 orders、ticket_locks、review_records；游客数为真实 POI + sandbox 演示基准，不作为筛选结果。"
  };
}

function normalizeAdminMetricsFilters(filters: AdminMetricsFilter) {
  return {
    keyword: filters.keyword?.trim() ?? "",
    scenic: filters.scenic && filters.scenic !== "全部景区" ? filters.scenic : "",
    status: filters.status && filters.status !== "全部状态" ? filters.status : "",
    date: filters.date?.trim() ?? ""
  };
}

function hasAdminMetricsFilters(filters: ReturnType<typeof normalizeAdminMetricsFilters>) {
  return Boolean(filters.keyword || filters.scenic || filters.status || filters.date);
}

function adminMetricsScopeLabel(filters: ReturnType<typeof normalizeAdminMetricsFilters>) {
  return [
    filters.keyword ? `关键词「${filters.keyword}」` : "全部关键词",
    filters.scenic || "全部景区",
    filters.status || "全部状态",
    filters.date || "实时总览"
  ].join(" / ");
}

function orderMatchesMetricFilters(row: OrderRow, filters: ReturnType<typeof normalizeAdminMetricsFilters>) {
  return matchesKeyword(filters.keyword, [row.id, row.title, row.poi_id, row.ticket_name, row.status])
    && matchesScenic(filters.scenic, [row.title, row.poi_id, row.ticket_name])
    && matchesDate(filters.date, row.visit_date)
    && matchesStatus(filters.status, [orderStatusLabel(row.status)]);
}

function lockMatchesMetricFilters(row: DashboardLockRow, filters: ReturnType<typeof normalizeAdminMetricsFilters>) {
  return matchesKeyword(filters.keyword, [row.id, row.product_id, row.product_name, row.poi_id, row.status])
    && matchesScenic(filters.scenic, [row.product_id, row.product_name, row.poi_id])
    && matchesDate(filters.date, row.visit_date)
    && matchesStatus(filters.status, [lockStatusLabel(row.status)]);
}

function reviewMatchesMetricFilters(row: ReviewMetricRow, filters: ReturnType<typeof normalizeAdminMetricsFilters>) {
  return matchesKeyword(filters.keyword, [row.subject_name, row.submitter, row.type, row.risk_note, row.status])
    && matchesScenic(filters.scenic, [row.subject_name, row.submitter, row.type, row.risk_note])
    && matchesDate(filters.date, row.submitted_at)
    && matchesStatus(filters.status, [row.status]);
}

function matchesKeyword(keyword: string, values: Array<string | undefined>) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeText(keyword);
  return values.some((value) => normalizeText(value).includes(normalizedKeyword));
}

function matchesScenic(scenic: string, values: Array<string | undefined>) {
  if (!scenic) return true;
  const aliases = scenicAliases(scenic).map(normalizeText);
  return values.some((value) => {
    const normalizedValue = normalizeText(value);
    return aliases.some((alias) => normalizedValue.includes(alias));
  });
}

function matchesDate(date: string, value: string | undefined) {
  return !date || Boolean(value?.startsWith(date));
}

function matchesStatus(status: string, labels: string[]) {
  if (!status) return true;
  return labels.some((label) => label === status || label.includes(status) || status.includes(label));
}

function scenicAliases(scenic: string) {
  if (scenic.includes("黄鹤楼")) return ["黄鹤楼", "yellow-crane", "yellow crane"];
  if (scenic.includes("江汉关")) return ["江汉关", "江滩", "jianghan"];
  if (scenic.includes("湖北") && scenic.includes("博物馆")) return ["湖北省博物馆", "湖北博物馆", "hubei"];
  if (scenic.includes("武昌")) return ["武昌", "wuchang"];
  return [scenic.replace(/(省)?博物馆$/, "")];
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function orderStatusLabel(status: Order["status"]) {
  const labels: Record<Order["status"], string> = {
    pending_payment: "待支付",
    paid: "已支付",
    ready_to_visit: "待出行",
    verified: "已核销",
    cancelled: "已取消",
    expired: "已过期",
    payment_failed: "支付失败",
    refunding: "退款中",
    refunded: "已退款"
  };
  return labels[status] ?? status;
}

function lockStatusLabel(status: TicketLock["status"]) {
  const labels: Record<TicketLock["status"], string> = {
    active: "活跃锁票",
    released: "已释放",
    confirmed: "已确认",
    expired: "已过期"
  };
  return labels[status] ?? status;
}

function isPaidOrderStatus(status: Order["status"]) {
  return ["paid", "ready_to_visit", "verified"].includes(status);
}

export function listMerchants() {
  return getDb().prepare(`
    SELECT id, name, category, status, inventory_status AS inventoryStatus, rating, order_count AS orderCount, review_status AS reviewStatus
    FROM merchants
    ORDER BY updated_at DESC
  `).all();
}

export function createMerchant(input: { name: string; category: string; phone?: string; desc?: string }, actor: AuthUser) {
  const now = new Date().toISOString();
  const id = createId("merchant");
  getDb().prepare(`
    INSERT INTO merchants (id, name, category, status, inventory_status, rating, order_count, review_status, created_at, updated_at)
    VALUES (?, ?, ?, '营业中', '待同步', '暂无', 0, '待审核', ?, ?)
  `).run(id, input.name, input.category, now, now);
  audit(actor, "merchant.create", "merchant", id, "success", input);
  return { id, ...input, status: "营业中", inventoryStatus: "待同步", rating: "暂无", orderCount: 0, reviewStatus: "待审核" };
}

export function syncMerchantInventory(id: string, actor: AuthUser) {
  const now = new Date().toISOString();
  const result = getDb().prepare("UPDATE merchants SET inventory_status = '已同步', updated_at = ? WHERE id = ?").run(now, id);
  if (!result.changes) throw new DomainError(404, "Merchant not found", "merchant_not_found");
  audit(actor, "merchant.inventory.sync", "merchant", id, "success", {});
  return { ok: true, id, inventoryStatus: "已同步" };
}

export function listReviews() {
  return getDb().prepare(`
    SELECT id, subject_name AS subjectName, submitter, type, risk_note AS riskNote, status, submitted_at AS submittedAt, reviewed_by AS reviewedBy, remark
    FROM review_records
    ORDER BY submitted_at DESC
  `).all();
}

export function decideReview(id: string, status: "已通过" | "已驳回" | "转人工复核", remark: string, actor: AuthUser) {
  if (status === "已驳回" && !remark.trim()) throw new DomainError(400, "驳回必须填写审核备注", "review_remark_required");
  const now = new Date().toISOString();
  const result = getDb().prepare(`
    UPDATE review_records SET status = ?, reviewed_by = ?, remark = ?, updated_at = ? WHERE id = ?
  `).run(status, actor.id, remark, now, id);
  if (!result.changes) throw new DomainError(404, "Review not found", "review_not_found");
  audit(actor, "review.decide", "review", id, "success", { status, remark });
  return { ok: true, id, status, remark };
}

export function getTicketOptions(poiId: string, visitDate = todayISO()) {
  return getActiveTicketProvider().getOptions(poiId, visitDate);
}

function getSandboxTicketOptions(poiId: string, visitDate = todayISO()) {
  expireLocks();
  const products = getDb().prepare(`
    SELECT p.id, p.poi_id, p.name, p.description, p.price, p.status,
      COALESCE(SUM(i.available_stock), 0) AS stock
    FROM ticket_products p
    LEFT JOIN ticket_inventory i ON i.product_id = p.id AND i.visit_date = ?
    WHERE p.poi_id = ?
    GROUP BY p.id
    ORDER BY p.price DESC, p.id
  `).all(visitDate, poiId) as TicketProductRow[];
  const slots = getDb().prepare(`
    SELECT s.id, s.start_time, s.end_time, s.status,
      COALESCE(SUM(i.available_stock), 0) AS stock
    FROM ticket_slots s
    LEFT JOIN ticket_inventory i ON i.slot_id = s.id AND i.visit_date = ?
    WHERE s.poi_id = ?
    GROUP BY s.id
    ORDER BY s.start_time
  `).all(visitDate, poiId) as TicketSlotRow[];
  return {
    products: products.map((row) => ({
      id: row.id,
      poiId: row.poi_id,
      name: row.name,
      desc: row.description,
      price: row.price,
      stock: row.stock,
      status: row.stock <= 0 ? "soldOut" : row.status
    } satisfies TicketProduct)),
    slots: slots.map((row) => ({
      id: row.id,
      time: `${row.start_time}-${row.end_time}`,
      stock: row.stock,
      status: row.stock <= 0 ? "soldOut" : row.status
    } satisfies TicketSlot))
  };
}

export function lockTickets(input: { productId: string; slotId: string; visitDate: string; quantity: number }, actor: AuthUser) {
  return getActiveTicketProvider().lock(input, actor);
}

function lockSandboxTickets(input: { productId: string; slotId: string; visitDate: string; quantity: number }, actor: AuthUser) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new DomainError(400, "Invalid quantity", "invalid_quantity");
  return withTransaction(() => {
    expireLocks();
    const now = new Date().toISOString();
    const inventory = getDb().prepare(`
      SELECT id, available_stock AS availableStock
      FROM ticket_inventory
      WHERE product_id = ? AND slot_id = ? AND visit_date = ?
    `).get(input.productId, input.slotId, input.visitDate) as { id: number; availableStock: number } | undefined;
    if (!inventory) throw new DomainError(404, "Ticket inventory not found", "inventory_not_found");
    if (inventory.availableStock < input.quantity) throw new DomainError(409, "Ticket inventory is insufficient", "inventory_insufficient");

    getDb().prepare(`
      UPDATE ticket_inventory
      SET available_stock = available_stock - ?, locked_stock = locked_stock + ?, updated_at = ?
      WHERE id = ? AND available_stock >= ?
    `).run(input.quantity, input.quantity, now, inventory.id, input.quantity);

    const id = createId("lock");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    getDb().prepare(`
      INSERT INTO ticket_locks (id, product_id, slot_id, visit_date, quantity, status, user_id, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(id, input.productId, input.slotId, input.visitDate, input.quantity, actor.id, expiresAt, now, now);
    audit(actor, "ticket.lock", "ticket_lock", id, "success", input);
    return getTicketLock(id);
  });
}

export function getTicketLock(id: string) {
  expireLocks();
  const row = getDb().prepare("SELECT * FROM ticket_locks WHERE id = ?").get(id) as TicketLockRow | undefined;
  if (!row) throw new DomainError(404, "Ticket lock not found", "ticket_lock_not_found");
  return mapTicketLock(row);
}

export function releaseTicketLock(id: string, actor?: AuthUser) {
  return getActiveTicketProvider().release(id, actor);
}

function releaseSandboxTicketLock(id: string, actor?: AuthUser) {
  return withTransaction(() => releaseTicketLockInternal(id, actor, "released"));
}

export function createOrder(input: Omit<Order, "id" | "createdAt" | "updatedAt" | "status" | "paymentProvider"> & { lockId?: string }, actor: AuthUser) {
  if (!input.title || !input.ticketId || !input.slotId) throw new DomainError(400, "Missing order product fields", "missing_order_fields");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new DomainError(400, "Invalid quantity", "invalid_quantity");
  if (!input.visitorInfo?.length) throw new DomainError(400, "Missing visitor info", "missing_visitor_info");
  if (!input.lockId) throw new DomainError(400, "Ticket lock is required before creating an order", "ticket_lock_required");
  const lockId = input.lockId;

  return withTransaction(() => {
    expireLocks();
    const lock = getDb().prepare("SELECT * FROM ticket_locks WHERE id = ?").get(lockId) as TicketLockRow | undefined;
    if (!lock || lock.status !== "active") throw new DomainError(409, "Ticket lock is not active", "ticket_lock_inactive");
    if (lock.user_id && lock.user_id !== actor.id && actor.role !== "admin") throw new DomainError(403, "Ticket lock belongs to another user", "ticket_lock_forbidden");
    if (lock.quantity !== input.quantity || lock.product_id !== input.ticketId || lock.slot_id !== input.slotId || lock.visit_date !== input.visitDate) {
      throw new DomainError(409, "Order fields do not match ticket lock", "ticket_lock_mismatch");
    }

    const now = new Date().toISOString();
    const id = createOrderId();
    getDb().prepare(`
      INSERT INTO orders
        (id, user_id, title, poi_id, ticket_id, ticket_name, slot_id, slot_time, visit_date, quantity, amount, status,
         payment_provider, lock_id, visitor_info_json, image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'sandbox', ?, ?, ?, ?, ?)
    `).run(
      id,
      actor.id,
      input.title,
      input.poiId,
      input.ticketId,
      input.ticketName,
      input.slotId,
      input.slotTime,
      input.visitDate,
      input.quantity,
      input.amount,
      lockId,
      JSON.stringify(input.visitorInfo),
      input.image ?? null,
      now,
      now
    );
    getDb().prepare("UPDATE ticket_locks SET order_id = ?, updated_at = ? WHERE id = ?").run(id, now, lockId);
    audit(actor, "order.create", "order", id, "success", { lockId });
    return getOrder(id);
  });
}

export function getOrder(id: string) {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row) throw new DomainError(404, "Order not found", "order_not_found");
  return mapOrder(row);
}

export function listOrders(actor: AuthUser) {
  const rows = actor.role === "admin" || actor.role === "operator" || actor.role === "merchant"
    ? getDb().prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as OrderRow[]
    : getDb().prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(actor.id) as OrderRow[];
  return rows.map(mapOrder);
}

export function createPayment(input: { orderId: string; provider?: string }, actor: AuthUser) {
  return withTransaction(() => {
    const order = getOrder(input.orderId);
    if (order.status !== "pending_payment") throw new DomainError(409, "Order is not pending payment", "order_not_pending");
    const provider = getActivePaymentProvider(input.provider);
    const now = new Date().toISOString();
    const id = createId("pay");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const providerPayment = provider.createPayment({ localPaymentId: id, order, expiresAt });
    getDb().prepare(`
      INSERT INTO payments (id, order_id, provider, amount, status, external_payment_id, checkout_url, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(
      id,
      order.id,
      provider.name,
      order.amount,
      providerPayment.externalPaymentId ?? null,
      providerPayment.checkoutUrl ?? null,
      expiresAt,
      now,
      now
    );
    audit(actor, "payment.create", "payment", id, "success", { orderId: order.id, provider: provider.name });
    return getPayment(id);
  });
}

export function getPayment(id: string) {
  const row = getDb().prepare("SELECT * FROM payments WHERE id = ?").get(id) as PaymentRow | undefined;
  if (!row) throw new DomainError(404, "Payment not found", "payment_not_found");
  const payment = mapPayment(row);
  return getActivePaymentProvider(payment.provider).queryPayment(payment);
}

export function applyPaymentStatus(paymentId: string, status: PaymentRecord["status"], actor: AuthUser | undefined, source = "sandbox") {
  return withTransaction(() => {
    const payment = getPayment(paymentId);
    const now = new Date().toISOString();
    getDb().prepare("UPDATE payments SET status = ?, updated_at = ? WHERE id = ?").run(status, now, paymentId);
    getDb().prepare(`
      INSERT INTO payment_events (id, payment_id, provider, event_type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(createId("evt"), paymentId, payment.provider, status, JSON.stringify({ source }), now);

    if (status === "paid") {
      const order = getOrder(payment.orderId);
      confirmLockForOrder(order);
      const voucherCode = order.voucherCode ?? `V${order.id.replace(/\W/g, "").slice(-10)}`;
      getDb().prepare("UPDATE orders SET status = 'paid', voucher_code = ?, updated_at = ? WHERE id = ?")
        .run(voucherCode, now, order.id);
      getDb().prepare(`
        INSERT OR IGNORE INTO ticket_vouchers (id, order_id, code, status, visit_date, slot_id, created_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?)
      `).run(createId("vch"), order.id, voucherCode, order.visitDate, order.slotId, now);
    }

    if (status === "failed" || status === "expired" || status === "cancelled") {
      const order = getOrder(payment.orderId);
      if (order.lockId) releaseTicketLockInternal(order.lockId, actor, status === "cancelled" ? "released" : "expired");
      getDb().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
        .run(status === "failed" ? "payment_failed" : status, now, order.id);
    }

    if (actor) audit(actor, "payment.status", "payment", paymentId, "success", { status, source });
    return getPayment(paymentId);
  });
}

export function cancelPayment(paymentId: string, actor: AuthUser) {
  const payment = getPayment(paymentId);
  if (payment.status !== "pending" && payment.status !== "created") throw new DomainError(409, "Only pending payment can be cancelled", "payment_not_cancellable");
  const status = getActivePaymentProvider(payment.provider).cancelPayment(payment);
  return applyPaymentStatus(paymentId, status, actor, "cancel");
}

export function refundPayment(paymentId: string, actor: AuthUser) {
  return withTransaction(() => {
    const payment = getPayment(paymentId);
    if (payment.status !== "paid") throw new DomainError(409, "Only paid payment can be refunded", "payment_not_refundable");
    getActivePaymentProvider(payment.provider).refundPayment(payment);
    const order = getOrder(payment.orderId);
    const now = new Date().toISOString();
    getDb().prepare("UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?").run(now, paymentId);
    getDb().prepare("UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?").run(now, order.id);
    getDb().prepare("UPDATE ticket_vouchers SET status = 'refunded' WHERE order_id = ? AND status = 'active'").run(order.id);
    getDb().prepare(`
      UPDATE ticket_inventory
      SET sold_stock = MAX(sold_stock - ?, 0), available_stock = available_stock + ?, updated_at = ?
      WHERE product_id = ? AND slot_id = ? AND visit_date = ?
    `).run(order.quantity, order.quantity, now, order.ticketId, order.slotId, order.visitDate);
    audit(actor, "payment.refund", "payment", paymentId, "success", { orderId: order.id });
    return getPayment(paymentId);
  });
}

export function recordWebhook(provider: string, input: { eventId?: string; paymentId: string; status: PaymentRecord["status"]; signature?: string; payload?: unknown }, actor?: AuthUser) {
  const paymentProvider = getActivePaymentProvider(provider);
  const verified = paymentProvider.verifyWebhook(input);
  const now = new Date().toISOString();
  try {
    getDb().prepare(`
      INSERT INTO webhook_events (id, provider, event_id, signature_valid, payload_json, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(createId("wh"), paymentProvider.name, verified.eventId, verified.signatureValid ? 1 : 0, JSON.stringify(verified.payload), now);
  } catch {
    return { duplicated: true, payment: getPayment(verified.paymentId) };
  }
  if (!verified.signatureValid) throw new DomainError(401, "Webhook signature is invalid or missing", "webhook_signature_invalid");
  return { duplicated: false, payment: applyPaymentStatus(verified.paymentId, verified.status, actor, `webhook:${paymentProvider.name}`) };
}

export function confirmTicketLock(input: { lockId: string; orderId: string }, actor: AuthUser) {
  return getActiveTicketProvider().confirm(input, actor);
}

function confirmSandboxTicketLock(input: { lockId: string; orderId: string }, actor: AuthUser) {
  return withTransaction(() => {
    const order = getOrder(input.orderId);
    if (order.lockId !== input.lockId) throw new DomainError(409, "Order and lock do not match", "ticket_lock_mismatch");
    confirmLockForOrder(order);
    audit(actor, "ticket.confirm", "ticket_lock", input.lockId, "success", { orderId: input.orderId });
    return getTicketLock(input.lockId);
  });
}

export function verifyVoucher(input: { voucherCode: string; visitDate?: string; slotId?: string }, actor: AuthUser) {
  return getActiveTicketProvider().verify(input, actor);
}

function verifySandboxVoucher(input: { voucherCode: string; visitDate?: string; slotId?: string }, actor: AuthUser) {
  const voucher = getDb().prepare("SELECT * FROM ticket_vouchers WHERE code = ?").get(input.voucherCode) as VoucherRow | undefined;
  if (!voucher) throw new DomainError(404, "Voucher not found", "voucher_not_found");
  if (voucher.status !== "active") throw new DomainError(409, "Voucher is not active", "voucher_inactive");
  if (input.visitDate && voucher.visit_date !== input.visitDate) throw new DomainError(409, "Voucher visit date mismatch", "voucher_date_mismatch");
  if (input.slotId && voucher.slot_id !== input.slotId) throw new DomainError(409, "Voucher slot mismatch", "voucher_slot_mismatch");

  const now = new Date().toISOString();
  getDb().prepare("UPDATE ticket_vouchers SET status = 'verified', verified_at = ?, verified_by = ? WHERE id = ?")
    .run(now, actor.id, voucher.id);
  getDb().prepare("UPDATE orders SET status = 'verified', updated_at = ? WHERE id = ?").run(now, voucher.order_id);
  audit(actor, "ticket.verify", "voucher", voucher.id, "success", { voucherCode: input.voucherCode });
  const verifiedVoucher = getVoucherByOrder(voucher.order_id);
  if (!verifiedVoucher) throw new DomainError(500, "Voucher verification failed", "voucher_verification_failed");
  return verifiedVoucher;
}

export function getVoucherByOrder(orderId: string) {
  const row = getDb().prepare("SELECT * FROM ticket_vouchers WHERE order_id = ?").get(orderId) as VoucherRow | undefined;
  if (!row) return undefined;
  return mapVoucher(row);
}

export function audit(actor: AuthUser | undefined, action: string, targetType: string, targetId: string, result: string, metadata: unknown) {
  getDb().prepare(`
    INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, result, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(actor?.id ?? null, action, targetType, targetId, result, JSON.stringify(metadata ?? {}), new Date().toISOString());
}

export function recordMapProviderLog(provider: string, action: string, status: string, request: unknown, response: unknown) {
  getDb().prepare(`
    INSERT INTO map_provider_logs (provider, action, status, request_json, response_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(provider, action, status, JSON.stringify(request ?? {}), JSON.stringify(response ?? {}), new Date().toISOString());
}

export function recordOperation(input: { scope?: OperationScope; type?: string; label?: string; metadata?: unknown }, actor?: AuthUser): OperationResult {
  const label = input.label?.trim();
  if (!label) throw new DomainError(400, "Operation label is required", "operation_label_required");
  const type = input.type?.trim() || "ui.action";
  const scope = input.scope ?? "visitor";
  if (!["visitor", "admin", "merchant", "system"].includes(scope)) {
    throw new DomainError(400, "Invalid operation scope", "operation_scope_invalid");
  }

  const id = createId("op");
  const now = new Date().toISOString();
  const status: OperationResult["status"] = isQueuedOperation(type) ? "queued" : "completed";
  const message = operationMessage(label, type, status);
  getDb().prepare(`
    INSERT INTO operation_records
      (id, scope, type, label, status, message, actor_user_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, scope, type, label, status, message, actor?.id ?? null, JSON.stringify(input.metadata ?? {}), now);
  audit(actor, `operation.${type}`, "operation", id, "success", { scope, label, status });
  return mapOperationRecord({
    id,
    scope,
    type,
    label,
    status,
    message,
    actor_user_id: actor?.id,
    metadata_json: JSON.stringify(input.metadata ?? {}),
    created_at: now
  });
}

export function getOperation(id: string) {
  const row = getDb().prepare("SELECT * FROM operation_records WHERE id = ?").get(id) as OperationRecordRow | undefined;
  if (!row) throw new DomainError(404, "Operation not found", "operation_not_found");
  return mapOperationRecord(row);
}

export function renderOperationArtifact(id: string) {
  const operation = getOperation(id);
  const createdAt = operation.createdAt.replace("T", " ").slice(0, 19);
  if (operation.type.includes("report")) {
    return {
      contentType: "text/markdown; charset=utf-8",
      filename: `${operation.label.replace(/\s+/g, "-") || "operation-report"}.md`,
      body: [
        `# ${operation.label}`,
        "",
        `- 操作范围：${operation.scope}`,
        `- 操作类型：${operation.type}`,
        `- 处理状态：${operation.status}`,
        `- 生成时间：${createdAt}`,
        "",
        operation.message,
        "",
        "本文件由本地演示后端生成，用于验证前端操作闭环。"
      ].join("\n")
    };
  }

  return {
    contentType: "text/csv; charset=utf-8",
    filename: `${operation.label.replace(/\s+/g, "-") || "operation-export"}.csv`,
    body: [
      "id,scope,type,label,status,createdAt",
      [operation.id, operation.scope, operation.type, operation.label, operation.status, createdAt]
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(",")
    ].join("\n")
  };
}

const sandboxTicketProvider: TicketProvider = {
  name: "sandbox",
  getOptions: getSandboxTicketOptions,
  lock: lockSandboxTickets,
  release: releaseSandboxTicketLock,
  confirm: confirmSandboxTicketLock,
  verify: verifySandboxVoucher
};

function getActivePaymentProvider(providerName?: string) {
  const env = providerName ? { ...process.env, PAYMENT_PROVIDER: providerName } : process.env;
  if (getConfiguredPaymentProvider(env) === "sandbox" && isProductionMode(process.env)) {
    throw new DomainError(503, "PAYMENT_PROVIDER=sandbox is demo-only and cannot be used in production.", "payment_provider_sandbox_forbidden");
  }
  return createPaymentProvider(env, failClosedProvider);
}

function getActiveTicketProvider() {
  if (getConfiguredTicketProvider(process.env) === "sandbox" && isProductionMode(process.env)) {
    throw new DomainError(503, "TICKET_PROVIDER=sandbox is demo-only and cannot be used in production.", "ticket_provider_sandbox_forbidden");
  }
  return createTicketProvider(sandboxTicketProvider, process.env, failClosedProvider);
}

function failClosedProvider(message: string, code = "provider_not_available"): never {
  throw new DomainError(code.endsWith("_not_implemented") ? 501 : 503, message, code);
}

function confirmLockForOrder(order: Order) {
  if (!order.lockId) throw new DomainError(409, "Order has no ticket lock", "ticket_lock_missing");
  const lock = getDb().prepare("SELECT * FROM ticket_locks WHERE id = ?").get(order.lockId) as TicketLockRow | undefined;
  if (!lock || lock.status !== "active") return;
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE ticket_inventory
    SET locked_stock = MAX(locked_stock - ?, 0), sold_stock = sold_stock + ?, updated_at = ?
    WHERE product_id = ? AND slot_id = ? AND visit_date = ?
  `).run(lock.quantity, lock.quantity, now, lock.product_id, lock.slot_id, lock.visit_date);
  getDb().prepare("UPDATE ticket_locks SET status = 'confirmed', updated_at = ? WHERE id = ?").run(now, lock.id);
}

function releaseTicketLockInternal(id: string, actor: AuthUser | undefined, status: "released" | "expired") {
  const lock = getDb().prepare("SELECT * FROM ticket_locks WHERE id = ?").get(id) as TicketLockRow | undefined;
  if (!lock) throw new DomainError(404, "Ticket lock not found", "ticket_lock_not_found");
  if (lock.status !== "active") return mapTicketLock(lock);
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE ticket_inventory
    SET available_stock = available_stock + ?, locked_stock = MAX(locked_stock - ?, 0), updated_at = ?
    WHERE product_id = ? AND slot_id = ? AND visit_date = ?
  `).run(lock.quantity, lock.quantity, now, lock.product_id, lock.slot_id, lock.visit_date);
  getDb().prepare("UPDATE ticket_locks SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
  if (actor) audit(actor, "ticket.release", "ticket_lock", id, "success", { status });
  return getTicketLock(id);
}

function expireLocks() {
  const now = new Date().toISOString();
  const expired = getDb().prepare("SELECT * FROM ticket_locks WHERE status = 'active' AND expires_at <= ?").all(now) as TicketLockRow[];
  expired.forEach((lock) => releaseTicketLockInternal(lock.id, undefined, "expired"));
}

function mapTicketLock(row: TicketLockRow): TicketLock {
  return {
    id: row.id,
    productId: row.product_id,
    slotId: row.slot_id,
    visitDate: row.visit_date,
    quantity: row.quantity,
    status: row.status,
    orderId: row.order_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    title: row.title,
    poiId: row.poi_id,
    ticketId: row.ticket_id,
    ticketName: row.ticket_name,
    slotId: row.slot_id,
    slotTime: row.slot_time,
    visitDate: row.visit_date,
    quantity: row.quantity,
    amount: row.amount,
    status: row.status,
    paymentProvider: row.payment_provider,
    lockId: row.lock_id,
    visitorInfo: JSON.parse(row.visitor_info_json) as VisitorInfo[],
    voucherCode: row.voucher_code,
    image: row.image,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    amount: row.amount,
    status: row.status,
    externalPaymentId: row.external_payment_id,
    checkoutUrl: row.checkout_url,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVoucher(row: VoucherRow): TicketVoucher {
  return {
    id: row.id,
    orderId: row.order_id,
    code: row.code,
    status: row.status,
    visitDate: row.visit_date,
    slotId: row.slot_id,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    createdAt: row.created_at
  };
}

function mapOperationRecord(row: OperationRecordRow): OperationResult {
  const downloadUrl = row.type.includes("export") || row.type.includes("report")
    ? `/api/operations/${encodeURIComponent(row.id)}/download`
    : undefined;
  return {
    id: row.id,
    scope: row.scope,
    type: row.type,
    label: row.label,
    status: row.status,
    message: row.message,
    downloadUrl,
    createdAt: row.created_at
  };
}

function isQueuedOperation(type: string) {
  return ["batch", "report", "export", "workflow.publish", "knowledge.reindex"].some((keyword) => type.includes(keyword));
}

function operationMessage(label: string, type: string, status: OperationResult["status"]) {
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

  const labelMessage = operationMessageForLabel(label);
  if (labelMessage) return labelMessage;

  return status === "queued" ? `${label}已进入处理队列。` : `已收到「${label}」操作（演示模式，未发生真实业务变更）。`;
}

function operationMessageForLabel(label: string) {
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

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function createOrderId() {
  return `ORD${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
