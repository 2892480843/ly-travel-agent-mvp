import { describe, expect, it } from "vitest";
import {
  defaultAuthSessionSecret,
  getWeakSessionSecretReasons,
  isWeakSessionSecret,
  validatePaymentProviderConfig,
  validateProductionRuntimeConfig,
  validateTicketProviderConfig
} from "./runtimeConfig";

const strongSecret = "ly_prod_7VvJafD4x29mKQhG8tP6sY3nR5cWbZ1q";

describe("runtimeConfig", () => {
  it("classifies default and short session secrets as weak", () => {
    expect(isWeakSessionSecret(defaultAuthSessionSecret)).toBe(true);
    expect(getWeakSessionSecretReasons(defaultAuthSessionSecret)).toContain("uses a known default or placeholder value");
    expect(isWeakSessionSecret("short-secret")).toBe(true);
    expect(isWeakSessionSecret(strongSecret)).toBe(false);
  });

  it("marks sandbox providers and weak secrets as production failures", () => {
    const issues = validateProductionRuntimeConfig({
      AUTH_SESSION_SECRET: defaultAuthSessionSecret,
      PAYMENT_PROVIDER: "sandbox",
      TICKET_PROVIDER: "sandbox"
    });

    expect(issues.filter((issue) => issue.severity === "fail").map((issue) => issue.key)).toEqual([
      "AUTH_SESSION_SECRET",
      "PAYMENT_PROVIDER",
      "TICKET_PROVIDER"
    ]);
  });

  it("requires webhook secret and API credentials for non-sandbox payment providers", () => {
    const missing = validatePaymentProviderConfig({
      PAYMENT_PROVIDER: "gateway",
      PAYMENT_API_BASE_URL: "https://pay.example",
      PAYMENT_API_KEY: "test-key"
    }, true);

    expect(missing).toEqual([
      expect.objectContaining({ key: "PAYMENT_WEBHOOK_SECRET", severity: "fail" })
    ]);

    expect(validatePaymentProviderConfig({
      PAYMENT_PROVIDER: "gateway",
      PAYMENT_API_BASE_URL: "https://pay.example",
      PAYMENT_API_KEY: "test-key",
      PAYMENT_WEBHOOK_SECRET: "webhook-secret"
    }, true)).toEqual([
      expect.objectContaining({ key: "PAYMENT_PROVIDER_ADAPTER", severity: "fail" })
    ]);
  });

  it("requires base URL, token, and secret for non-sandbox ticket providers", () => {
    const missing = validateTicketProviderConfig({
      TICKET_PROVIDER: "vendor",
      TICKET_API_BASE_URL: "https://ticket.example",
      TICKET_API_TOKEN: "test-token"
    }, true);

    expect(missing).toEqual([
      expect.objectContaining({ key: "TICKET_API_SECRET", severity: "fail" })
    ]);

    expect(validateTicketProviderConfig({
      TICKET_PROVIDER: "vendor",
      TICKET_API_BASE_URL: "https://ticket.example",
      TICKET_API_TOKEN: "test-token",
      TICKET_API_SECRET: "ticket-secret"
    }, true)).toEqual([
      expect.objectContaining({ key: "TICKET_PROVIDER_ADAPTER", severity: "fail" })
    ]);
  });
});
