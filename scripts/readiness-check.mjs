import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const mode = args.has("--production") || process.env.READINESS_MODE === "production" ? "production" : "mvp";
const env = { ...loadDotEnv(join(root, ".env.example")), ...loadDotEnv(join(root, ".env")), ...process.env };
const checks = [];

checkProjectFiles();
checkBuildArtifacts();
checkDatabase();
checkEnvironment();
await checkApiHealth();
printReport();

const hasFailures = checks.some((check) => check.status === "fail");
process.exitCode = hasFailures ? 1 : 0;

function checkProjectFiles() {
  fileCheck("package manifest", "package.json", { required: true });
  fileCheck("frontend entry", "src/main.tsx", { required: true });
  fileCheck("server entry", "server/index.ts", { required: true });
  fileCheck("POI source data", "poi-data/usable-pois.json", { required: true });
}

function checkBuildArtifacts() {
  fileCheck("frontend build artifact", "dist/index.html", { required: true });
  fileCheck("server build artifact", "server-dist/server/index.js", { required: true });
}

function checkDatabase() {
  const databasePath = resolveDatabasePath(env.DATABASE_URL);
  if (!databasePath) {
    add("database path", "fail", "DATABASE_URL is missing or unsupported.");
    return;
  }
  if (!existsSync(databasePath)) {
    add("SQLite database", "fail", `${relative(databasePath)} is missing. Run npm run db:init.`);
    return;
  }
  try {
    accessSync(databasePath, constants.R_OK | constants.W_OK);
    const sizeKb = Math.round(statSync(databasePath).size / 1024);
    add("SQLite database", "pass", `${relative(databasePath)} is readable/writable (${sizeKb} KB).`);
  } catch (error) {
    add("SQLite database", "fail", `${relative(databasePath)} is not readable/writable: ${error.message}`);
  }
}

function checkEnvironment() {
  fileCheck("local env file", ".env", { required: mode === "production" });

  const secret = String(env.AUTH_SESSION_SECRET ?? "");
  const secretReasons = getWeakSessionSecretReasons(secret);
  if (secretReasons.length) {
    add("session secret", productionStatus(), `AUTH_SESSION_SECRET must be replaced before production: ${secretReasons.join("; ")}.`);
  } else {
    add("session secret", "pass", "AUTH_SESSION_SECRET is configured with non-placeholder length.");
  }

  const paymentProvider = normalizeProviderName(env.PAYMENT_PROVIDER, "sandbox");
  if (paymentProvider === "sandbox") {
    add("payment provider", productionStatus(), "PAYMENT_PROVIDER=sandbox is demo-only.");
  } else {
    const missingPaymentKeys = ["PAYMENT_API_BASE_URL", "PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET"].filter((key) => !String(env[key] ?? "").trim());
    if (missingPaymentKeys.length) {
      add("payment provider config", "fail", `${missingPaymentKeys.join(", ")} required when PAYMENT_PROVIDER=${paymentProvider}.`);
    } else {
      add("payment provider", "pass", `PAYMENT_PROVIDER=${paymentProvider} has base URL, API key, and webhook secret configured.`);
      add("payment adapter boundary", productionStatus(), "Non-sandbox payment provider is fail-closed until a vendor-specific adapter is implemented.");
    }
  }

  const ticketProvider = normalizeProviderName(env.TICKET_PROVIDER, "sandbox");
  if (ticketProvider === "sandbox") {
    add("ticket provider", productionStatus(), "TICKET_PROVIDER=sandbox is demo-only.");
  } else {
    const missingTicketKeys = ["TICKET_API_BASE_URL", "TICKET_API_TOKEN", "TICKET_API_SECRET"].filter((key) => !String(env[key] ?? "").trim());
    if (missingTicketKeys.length) {
      add("ticket provider config", "fail", `${missingTicketKeys.join(", ")} required when TICKET_PROVIDER=${ticketProvider}.`);
    } else {
      add("ticket provider", "pass", `TICKET_PROVIDER=${ticketProvider} has API base URL, token, and secret configured.`);
      add("ticket adapter boundary", productionStatus(), "Non-sandbox ticket provider is fail-closed until a vendor-specific adapter is implemented.");
    }
  }

  const mapProvider = String(env.MAP_PROVIDER ?? "fallback");
  if (mapProvider === "fallback") {
    add("server map provider", productionStatus(), "MAP_PROVIDER=fallback uses deterministic routes.");
  } else if (mapProvider === "amap" && !env.MAP_API_KEY) {
    add("server map key", productionStatus(), "MAP_PROVIDER=amap requires MAP_API_KEY.");
  } else {
    add("server map provider", "pass", `MAP_PROVIDER=${mapProvider} is configured.`);
  }

  if (mapProvider === "amap" && !env.VITE_AMAP_JS_KEY) {
    add("browser map key", productionStatus(), "VITE_AMAP_JS_KEY is required for the /map browser view.");
  } else if (env.VITE_AMAP_JS_KEY) {
    add("browser map key", "pass", "VITE_AMAP_JS_KEY is configured.");
  } else {
    add("browser map key", "warn", "Browser map runs with local fallback view.");
  }

  const aiProvider = String(env.AI_PROVIDER ?? "fallback");
  if (aiProvider === "fallback") {
    add("AI provider", "warn", "AI_PROVIDER=fallback uses deterministic agent responses.");
  } else if (!env.AI_BASE_URL || !env.AI_API_KEY || !env.AI_MODEL) {
    add("AI provider", "fail", "AI_BASE_URL, AI_API_KEY, and AI_MODEL are required for model-backed agent calls.");
  } else {
    add("AI provider", "pass", `AI_PROVIDER=${aiProvider} is configured.`);
  }

  if (env.VITE_API_BASE_URL) {
    add("frontend API base", "pass", "VITE_API_BASE_URL is configured.");
  } else {
    add("frontend API base", "warn", "VITE_API_BASE_URL is empty; frontend will use local fallback paths.");
  }
}

async function checkApiHealth() {
  const apiBase = String(env.API_BASE_URL ?? env.VITE_API_BASE_URL ?? `http://localhost:${env.PORT ?? "8787"}`).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${apiBase}/api/health`, { signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      add("API health", mode === "production" ? "fail" : "warn", `GET /api/health returned ${response.status}.`);
      return;
    }
    add("API health", "pass", `${body.service ?? "service"} is reachable at ${apiBase}.`);
  } catch (error) {
    add("API health", mode === "production" ? "fail" : "warn", `API is not reachable: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function fileCheck(label, file, options = {}) {
  const path = join(root, file);
  if (!existsSync(path)) {
    add(label, options.required ? "fail" : "warn", `${file} is missing.`);
    return;
  }
  add(label, "pass", `${file} exists.`);
}

function add(label, status, detail) {
  checks.push({ label, status, detail });
}

function productionStatus() {
  return mode === "production" ? "fail" : "warn";
}

function normalizeProviderName(value, fallback) {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return normalized || fallback;
}

function getWeakSessionSecretReasons(secret) {
  const value = String(secret ?? "").trim();
  const weakSecrets = new Set(["", "change-me", "change-me-in-real-deployments", "sandbox", "secret", "dev", "development", "password", "admin"]);
  const reasons = [];

  if (weakSecrets.has(value.toLowerCase())) reasons.push("uses a known default or placeholder value");
  if (value.length < 32) reasons.push("is shorter than 32 characters");
  if (/change[-_ ]?me|replace[-_ ]?me|your[-_ ]?secret|example|placeholder/i.test(value)) reasons.push("contains placeholder wording");
  if (/^(.)\1+$/.test(value)) reasons.push("contains only repeated characters");

  return [...new Set(reasons)];
}

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    result[key] = raw.replace(/^["']|["']$/g, "");
  }
  return result;
}

function resolveDatabasePath(databaseUrl) {
  const value = String(databaseUrl ?? "file:./data/ly.sqlite");
  if (!value.startsWith("file:")) return undefined;
  return resolve(root, value.replace(/^file:/, ""));
}

function relative(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function printReport() {
  const totals = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Readiness check (${mode})`);
  for (const check of checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`);
  }
  console.log(JSON.stringify({ mode, totals }, null, 2));
}
