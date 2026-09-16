import { config } from "./config.js";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[config.logLevel as Level] ?? ORDER.info;

/**
 * Structured logger. Never accepts raw credentials/secret values: callers are
 * responsible for redacting before logging. Provides a `redact` helper.
 */
function emit(level: Level, message: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(entry)
      : `[${entry.ts}] ${level.toUpperCase()} ${message} ${JSON.stringify(fields)}`;
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};

/** Redact common credential shapes from arbitrary strings before logging. */
export function redact(input: string): string {
  return input
    .replace(/(authorization\s*:\s*)bearer\s+\S+/gi, "$1bearer ••••")
    .replace(/(api[-_ ]?key)\s*[=:]\s*[^\s,;&]+/gi, "$1=••••")
    .replace(/("?(?:password|secret|token|api_key|apikey)"?\s*[=:]\s*")[^"]*(")/gi, "$1••••$2");
}