import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, initializeDatabase } from "./db";
import {
  createOrder,
  createPayment,
  getOrder,
  getTicketOptions,
  lockTickets,
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
    const options = getTicketOptions("ticket-yellow-crane-tower-demo", "2026-06-06");
    const product = options.products[0]!;
    const slot = options.slots[0]!;
    const lock = lockTickets({ productId: product.id, slotId: slot.id, visitDate: "2026-06-06", quantity: 1 }, visitor);
    const order = createOrder({
      title: `黄鹤楼 ${product.name} x1`,
      poiId: "ticket-yellow-crane-tower-demo",
      ticketId: product.id,
      ticketName: product.name,
      slotId: slot.id,
      slotTime: slot.time,
      visitDate: "2026-06-06",
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
});
