import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal .env loader (no external dependency). Values already present in the
 * environment take precedence. Missing file is not an error.
 */
function loadDotEnv(file = ".env"): void {
  const target = path.resolve(process.cwd(), file);
  if (!existsSync(target)) return;
  const raw = readFileSync(target, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: string;
  appUrl: string;
  corsOrigins: string[];
  databasePath: string;
  jwtSecret: string;
  jwtTtl: string;
  vaultKey: string | null;
  ai: {
    defaultProvider: string;
    defaultBaseUrl: string;
    defaultApiKey: string;
    defaultModel: string;
    requestTimeoutMs: number;
    maxOutputTokens: number;
  };
  rateLimit: { windowMs: number; max: number };
  execution: {
    timeoutMs: number;
    scriptTimeoutMs: number;
    maxRedirects: number;
    maxResponseCaptureBytes: number;
  };
}

export const config: Config = {
  port: envInt("PORT", 4000),
  host: env("HOST", "127.0.0.1"),
  nodeEnv: env("NODE_ENV", "development"),
  logLevel: env("LOG_LEVEL", "info"),
  appUrl: env("APP_URL", `http://localhost:${envInt("PORT", 4000)}`),
  corsOrigins: env("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  databasePath: env("DATABASE_PATH", path.join(process.cwd(), "data", "apiplatform.db")),
  jwtSecret: env("JWT_SECRET", "insecure-dev-secret-change-me"),
  jwtTtl: env("JWT_TTL", "24h"),
  vaultKey: env("VAULT_KEY") || null,
  ai: {
    defaultProvider: env("AI_DEFAULT_PROVIDER"),
    defaultBaseUrl: env("AI_DEFAULT_BASE_URL"),
    defaultApiKey: env("AI_DEFAULT_API_KEY"),
    defaultModel: env("AI_DEFAULT_MODEL"),
    requestTimeoutMs: envInt("AI_REQUEST_TIMEOUT_MS", 60000),
    maxOutputTokens: envInt("AI_MAX_OUTPUT_TOKENS", 2048),
  },
  rateLimit: {
    windowMs: envInt("RATE_LIMIT_WINDOW_MS", 60000),
    max: envInt("RATE_LIMIT_MAX", 300),
  },
  execution: {
    timeoutMs: envInt("REQUEST_EXECUTION_TIMEOUT_MS", 30000),
    scriptTimeoutMs: envInt("SCRIPT_TIMEOUT_MS", 3000),
    maxRedirects: envInt("MAX_REDIRECTS", 10),
    maxResponseCaptureBytes: envInt("MAX_RESPONSE_CAPTURE_BYTES", 2 * 1024 * 1024),
  },
};

export { __dirname as packageDir };