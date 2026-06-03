import type { Order, OrderStatus } from "../types";

const storageKey = "ly.demo.orders";

export function readOrders(): Order[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as Order[] : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order) {
  const orders = readOrders();
  const next = [order, ...orders.filter((item) => item.id !== order.id)];
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function saveOrders(orders: Order[]) {
  const next = mergeOrders(orders);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function mergeOrders(...groups: Order[][]) {
  const byId = new Map<string, Order>();
  groups.flat().forEach((order) => {
    const existing = byId.get(order.id);
    if (!existing || orderTimestamp(order) >= orderTimestamp(existing)) {
      byId.set(order.id, order);
    }
  });
  return Array.from(byId.values()).sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
  const orders = readOrders();
  const next = orders.map((order) => order.id === orderId ? {
    ...order,
    status,
    voucherCode: status === "paid" || status === "ready_to_visit" ? order.voucherCode ?? `V${order.id.slice(-8)}` : order.voucherCode,
    updatedAt: new Date().toISOString()
  } : order);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next.find((order) => order.id === orderId);
}

export function getLatestOrder(status?: OrderStatus) {
  return readOrders().find((order) => !status || order.status === status);
}

export function pickLatestUsableOrder(orders: Order[]) {
  return orders.find((order) => order.status === "paid" || order.status === "ready_to_visit")
    ?? orders.find((order) => order.status === "pending_payment")
    ?? orders[0];
}

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
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
  return labels[status];
}

function orderTimestamp(order: Order) {
  return new Date(order.updatedAt || order.createdAt).getTime() || 0;
}
