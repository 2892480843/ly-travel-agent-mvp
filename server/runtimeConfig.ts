export const defaultAuthSessionSecret = "change-me-in-real-deployments";

const weakSecretValues = new Set([
  "",
  "change-me",
  defaultAuthSessionSecret,
  "sandbox",
  "secret",
  "dev",
  "development",
  "password",
  "admin"
]);

const secretPlaceholderPatterns = [
  /change[-_ ]?me/i,
  /replace[-_ ]?me/i,
  /your[-_ ]?secret/i,
  /example/i,
  /placeholder/i
];

export type RuntimeEnv = Record<string, string | undefined>;

export type RuntimeConfigIssue = {
  key: string;
  severity: "fail" | "warn";
  message: string;
};

export function isProductionMode(env: RuntimeEnv = process.env) {
  return [env.NODE_ENV, env.APP_ENV, env.LY_ENV, env.READINESS_MODE]
    .some((value) => String(value ?? "").toLowerCase() === "production");
}

export function getConfiguredPaymentProvider(env: RuntimeEnv = process.env) {
  return normalizeProviderName(env.PAYMENT_PROVIDER, "sandbox");
}

export function getConfiguredTicketProvider(env: RuntimeEnv = process.env) {
  return normalizeProviderName(env.TICKET_PROVIDER, "sandbox");
}

export function isWeakSessionSecret(secret: string | undefined) {
  return getWeakSessionSecretReasons(secret).length > 0;
}

export function getWeakSessionSecretReasons(secret: string | undefined) {
  const value = String(secret ?? "").trim();
  const reasons: string[] = [];

  if (weakSecretValues.has(value.toLowerCase())) {
    reasons.push("uses a known default or placeholder value");
  }
  if (value.length < 32) {
    reasons.push("is shorter than 32 characters");
  }
  if (secretPlaceholderPatterns.some((pattern) => pattern.test(value))) {
    reasons.push("contains placeholder wording");
  }
  if (/^(.)\1+$/.test(value)) {
    reasons.push("contains only repeated characters");
  }

  return [...new Set(reasons)];
}

export function validateProductionRuntimeConfig(env: RuntimeEnv = process.env) {
  const issues: RuntimeConfigIssue[] = [];
  const secretReasons = getWeakSessionSecretReasons(env.AUTH_SESSION_SECRET);
  if (secretReasons.length) {
    issues.push({
      key: "AUTH_SESSION_SECRET",
      severity: "fail",
      message: `AUTH_SESSION_SECRET is weak: ${secretReasons.join("; ")}.`
    });
  }

  issues.push(...validatePaymentProviderConfig(env, true));
  issues.push(...validateTicketProviderConfig(env, true));

  return issues;
}

export function validatePaymentProviderConfig(env: RuntimeEnv = process.env, production = isProductionMode(env)) {
  const provider = getConfiguredPaymentProvider(env);
  const issues: RuntimeConfigIssue[] = [];

  if (provider === "sandbox") {
    issues.push({
      key: "PAYMENT_PROVIDER",
      severity: production ? "fail" : "warn",
      message: "PAYMENT_PROVIDER=sandbox is demo-only and cannot be used in production."
    });
    return issues;
  }

  const requiredKeys = ["PAYMENT_API_BASE_URL", "PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET"];
  for (const key of requiredKeys) {
    if (!String(env[key] ?? "").trim()) {
      issues.push({
        key,
        severity: "fail",
        message: `${key} is required when PAYMENT_PROVIDER=${provider}.`
      });
    }
  }
  if (!issues.some((issue) => issue.severity === "fail")) {
    issues.push({
      key: "PAYMENT_PROVIDER_ADAPTER",
      severity: production ? "fail" : "warn",
      message: `PAYMENT_PROVIDER=${provider} has required config, but no vendor-specific payment adapter is implemented yet.`
    });
  }

  return issues;
}

export function validateTicketProviderConfig(env: RuntimeEnv = process.env, production = isProductionMode(env)) {
  const provider = getConfiguredTicketProvider(env);
  const issues: RuntimeConfigIssue[] = [];

  if (provider === "sandbox") {
    issues.push({
      key: "TICKET_PROVIDER",
      severity: production ? "fail" : "warn",
      message: "TICKET_PROVIDER=sandbox is demo-only and cannot be used in production."
    });
    return issues;
  }

  const requiredKeys = ["TICKET_API_BASE_URL", "TICKET_API_TOKEN", "TICKET_API_SECRET"];
  for (const key of requiredKeys) {
    if (!String(env[key] ?? "").trim()) {
      issues.push({
        key,
        severity: "fail",
        message: `${key} is required when TICKET_PROVIDER=${provider}.`
      });
    }
  }
  if (!issues.some((issue) => issue.severity === "fail")) {
    issues.push({
      key: "TICKET_PROVIDER_ADAPTER",
      severity: production ? "fail" : "warn",
      message: `TICKET_PROVIDER=${provider} has required config, but no vendor-specific ticket adapter is implemented yet.`
    });
  }

  return issues;
}

export function assertProductionRuntimeConfig(env: RuntimeEnv = process.env) {
  if (!isProductionMode(env)) return;
  const failures = validateProductionRuntimeConfig(env).filter((issue) => issue.severity === "fail");
  if (!failures.length) return;
  throw new Error(`Production runtime configuration is not safe:\n${failures.map((issue) => `- ${issue.message}`).join("\n")}`);
}

function normalizeProviderName(value: string | undefined, fallback: string) {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return normalized || fallback;
}
