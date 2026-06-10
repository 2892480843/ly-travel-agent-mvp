import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, initializeDatabase } from "./db";
import { todayISO } from "./demoDates";
import {
  createOrder,
  createPayment,
  getAdminMetrics,
  getOrder,
  getTicketOptions,
  lockTickets,
  recordOperation,
  recordWebhook,
  type AuthUser
} from "./repositories";

const visitor: AuthUser = { id: "visitor", name: "游客小陈", role: "visitor" };
const savedEnv = { ...process.env };

describe("repositories sandbox payment and ticket flow", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ":memory:";
    process.env.PAYMENT_PROVIDER = "sandbox";
    process.env.TICKET_PROVIDER = "sandbox";
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
    delete process.env.LY_ENV;
    initializeDatabase();
  });

  afterEach(() => {
    closeDb();
    process.env = { ...savedEnv };
  });

  it("keeps sandbox lock to order to payment flow idempotent for duplicate webhook events", () => {
    const visitDate = todayISO();
    const options = getTicketOptions("ticket-yellow-crane-tower-demo", visitDate);
    const product = options.products[0]!;
    const slot = options.slots[0]!;
    const lock = lockTickets({ productId: product.id, slotId: slot.id, visitDate, quantity: 1 }, visitor);
    const order = createOrder({
      title: `黄鹤楼 ${product.name} x1`,
      poiId: "ticket-yellow-crane-tower-demo",
      ticketId: product.id,
      ticketName: product.name,
      slotId: slot.id,
      slotTime: slot.time,
      visitDate,
      quantity: 1,
      amount: product.price,
      lockId: lock.id,
      visitorInfo: [{ name: "张小文", credentialType: "id-card", credentialNo: "330***********1234" }]
    }, visitor);
    const payment = createPayment({ orderId: order.id, provider: "sandbox" }, visitor);

    const first = recordWebhook("sandbox", { eventId: "evt-paid-once", paymentId: payment.id, status: "paid" }, visitor);
    const duplicate = recordWebhook("sandbox", { eventId: "evt-paid-once", paymentId: payment.id, status: "paid" }, visitor);
    const finalOrder = getOrder(order.id);
    const paymentEventCount = (getDb().prepare("SELECT COUNT(*) AS count FROM payment_events WHERE payment_id = ?").get(payment.id) as { count: number }).count;
    const voucherCount = (getDb().prepare("SELECT COUNT(*) AS count FROM ticket_vouchers WHERE order_id = ?").get(order.id) as { count: number }).count;

    expect(first.duplicated).toBe(false);
    expect(first.payment.status).toBe("paid");
    expect(duplicate.duplicated).toBe(true);
    expect(duplicate.payment.status).toBe("paid");
    expect(finalOrder.voucherCode).toBeTruthy();
    expect(paymentEventCount).toBe(1);
    expect(voucherCount).toBe(1);
  });

  it("scopes admin metrics by scenic spot and review status", () => {
    const metrics = getAdminMetrics({ scenic: "黄鹤楼", status: "待审核" });
    const reviewMetric = metrics.kpis.find((item) => item.label === "待审核");
    const orderMetric = metrics.kpis.find((item) => item.label === "订单总数");

    expect(metrics.scopeLabel).toContain("黄鹤楼");
    expect(reviewMetric?.value).toBe("1");
    expect(orderMetric?.value).toBe("0");
    expect(metrics.sourceNote).toContain("orders");
  });

  it("scopes admin metrics by active ticket locks", () => {
    const visitDate = todayISO();
    const options = getTicketOptions("ticket-yellow-crane-tower-demo", visitDate);
    const product = options.products[0]!;
    const slot = options.slots[0]!;
    lockTickets({ productId: product.id, slotId: slot.id, visitDate, quantity: 1 }, visitor);

    const metrics = getAdminMetrics({ scenic: "黄鹤楼", status: "活跃锁票", date: visitDate });
    const lockMetric = metrics.kpis.find((item) => item.label === "活跃锁票");

    expect(metrics.scopeLabel).toBe(`全部关键词 / 黄鹤楼 / 活跃锁票 / ${visitDate}`);
    expect(lockMetric?.value).toBe("1");
  });

  it("returns specific operation messages instead of generic demo copy", () => {
    const addToList = recordOperation({ scope: "visitor", type: "ui.action", label: "加入清单" }, visitor);
    const audioGuide = recordOperation({ scope: "visitor", type: "guide.audio", label: "语音讲解" }, visitor);

    expect(addToList.message).toBe("已加入行程清单，可在右侧清单查看。");
    expect(audioGuide.message).toBe("语音讲解入口已打开；当前不会调用真实设备或第三方服务。");
    expect(addToList.message).not.toContain("演示操作");
    expect(audioGuide.message).not.toContain("演示链路");
  });
});
