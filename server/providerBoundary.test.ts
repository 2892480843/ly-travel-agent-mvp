import { describe, expect, it } from "vitest";
import type { Order } from "../src/types";
import { createPaymentProvider } from "./paymentProvider";
import { createTicketProvider, type TicketProvider } from "./ticketProvider";

const order: Order = {
  id: "order-1",
  title: "雷峰塔 成人票 x1",
  poiId: "ticket-leifeng-demo",
  ticketId: "adult",
  ticketName: "成人票",
  slotId: "08-10",
  slotTime: "08:00-10:00",
  visitDate: "2026-06-06",
  quantity: 1,
  amount: 40,
  status: "pending_payment",
  paymentProvider: "sandbox",
  visitorInfo: [{ name: "张小文", credentialType: "id-card", credentialNo: "330***********1234" }],
  createdAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z"
};

describe("provider boundaries", () => {
  it("keeps sandbox payment usable for local demos", () => {
    const provider = createPaymentProvider({ PAYMENT_PROVIDER: "sandbox" }, fail);

    const payment = provider.createPayment({
      localPaymentId: "pay_1",
      order,
      expiresAt: "2026-06-03T00:15:00.000Z"
    });
    const webhook = provider.verifyWebhook({ eventId: "evt-1", paymentId: "pay_1", status: "paid" });

    expect(provider.name).toBe("sandbox");
    expect(payment.checkoutUrl).toBe("sandbox://payments/pay_1");
    expect(webhook.signatureValid).toBe(true);
  });

  it("fails closed when a non-sandbox payment provider is missing webhook secret", () => {
    const provider = createPaymentProvider({
      PAYMENT_PROVIDER: "gateway",
      PAYMENT_API_BASE_URL: "https://pay.example",
      PAYMENT_API_KEY: "test-key"
    }, fail);

    expect(() => provider.createPayment({
      localPaymentId: "pay_1",
      order,
      expiresAt: "2026-06-03T00:15:00.000Z"
    })).toThrow(/PAYMENT_WEBHOOK_SECRET/);
  });

  it("keeps sandbox ticket provider usable for local demos", () => {
    const sandboxProvider = createSandboxTicketProvider();
    const provider = createTicketProvider(sandboxProvider, { TICKET_PROVIDER: "sandbox" }, fail);

    expect(provider.getOptions("ticket-leifeng-demo").products[0]?.id).toBe("adult");
  });

  it("fails closed when a non-sandbox ticket provider is missing required config", () => {
    const provider = createTicketProvider(createSandboxTicketProvider(), {
      TICKET_PROVIDER: "vendor",
      TICKET_API_BASE_URL: "https://ticket.example",
      TICKET_API_TOKEN: "test-token"
    }, fail);

    expect(() => provider.getOptions("ticket-leifeng-demo")).toThrow(/TICKET_API_SECRET/);
  });
});

function fail(message: string): never {
  throw new Error(message);
}

function createSandboxTicketProvider(): TicketProvider {
  return {
    name: "sandbox",
    getOptions: (poiId) => ({
      products: [{ id: "adult", poiId, name: "成人票", desc: "sandbox", price: 40, stock: 20, status: "available" }],
      slots: [{ id: "08-10", time: "08:00-10:00", stock: 20, status: "available" }]
    }),
    lock: () => ({
      id: "lock-1",
      productId: "adult",
      slotId: "08-10",
      visitDate: "2026-06-06",
      quantity: 1,
      status: "active",
      expiresAt: "2026-06-03T00:15:00.000Z",
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    }),
    release: () => ({
      id: "lock-1",
      productId: "adult",
      slotId: "08-10",
      visitDate: "2026-06-06",
      quantity: 1,
      status: "released",
      expiresAt: "2026-06-03T00:15:00.000Z",
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    }),
    confirm: () => ({
      id: "lock-1",
      productId: "adult",
      slotId: "08-10",
      visitDate: "2026-06-06",
      quantity: 1,
      status: "confirmed",
      expiresAt: "2026-06-03T00:15:00.000Z",
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    }),
    verify: () => ({
      id: "voucher-1",
      orderId: "order-1",
      code: "VOUCHER1",
      status: "active",
      visitDate: "2026-06-06",
      slotId: "08-10",
      createdAt: "2026-06-03T00:00:00.000Z"
    })
  };
}
