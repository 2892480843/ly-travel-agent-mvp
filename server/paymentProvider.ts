import type { Order, PaymentRecord, PaymentStatus } from "../src/types";
import { getConfiguredPaymentProvider, validatePaymentProviderConfig, type RuntimeEnv } from "./runtimeConfig";

export type PaymentProviderCreateInput = {
  localPaymentId: string;
  order: Order;
  expiresAt: string;
};

export type PaymentWebhookInput = {
  eventId?: string;
  paymentId: string;
  status: PaymentStatus;
  signature?: string;
  payload?: unknown;
};

export type PaymentWebhookVerification = {
  eventId: string;
  paymentId: string;
  status: PaymentStatus;
  signatureValid: boolean;
  payload: unknown;
};

export type PaymentProvider = {
  name: string;
  createPayment(input: PaymentProviderCreateInput): Pick<PaymentRecord, "externalPaymentId" | "checkoutUrl" | "status">;
  queryPayment(payment: PaymentRecord): PaymentRecord;
  cancelPayment(payment: PaymentRecord): PaymentStatus;
  refundPayment(payment: PaymentRecord): PaymentStatus;
  verifyWebhook(input: PaymentWebhookInput): PaymentWebhookVerification;
};

export function createPaymentProvider(
  env: RuntimeEnv = process.env,
  failClosed: (message: string, code?: string) => never
): PaymentProvider {
  const provider = getConfiguredPaymentProvider(env);
  if (provider === "sandbox") return sandboxPaymentProvider;

  const failures = validatePaymentProviderConfig(env, false).filter((issue) => issue.severity === "fail");
  if (failures.length) {
    return createFailClosedPaymentProvider(provider, () => failClosed(failures.map((issue) => issue.message).join(" "), "payment_provider_misconfigured"));
  }

  return createFailClosedPaymentProvider(provider, () => failClosed(
    `PAYMENT_PROVIDER=${provider} is configured, but no real payment adapter has been implemented for this provider.`,
    "payment_provider_not_implemented"
  ));
}

const sandboxPaymentProvider: PaymentProvider = {
  name: "sandbox",
  createPayment(input) {
    return {
      externalPaymentId: `sandbox-${input.localPaymentId}`,
      checkoutUrl: `sandbox://payments/${input.localPaymentId}`,
      status: "pending"
    };
  },
  queryPayment(payment) {
    return payment;
  },
  cancelPayment() {
    return "cancelled";
  },
  refundPayment() {
    return "refunded";
  },
  verifyWebhook(input) {
    return {
      eventId: input.eventId ?? `sandbox-${input.paymentId}-${input.status}`,
      paymentId: input.paymentId,
      status: input.status,
      signatureValid: true,
      payload: input.payload ?? input
    };
  }
};

function createFailClosedPaymentProvider(name: string, fail: () => never): PaymentProvider {
  return {
    name,
    createPayment: fail,
    queryPayment: fail,
    cancelPayment: fail,
    refundPayment: fail,
    verifyWebhook: fail
  };
}
