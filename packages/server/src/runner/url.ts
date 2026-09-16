import type { UrlQueryParam } from "@apiplatform/shared";

export interface BuildUrlOptions {
  baseUrl: string;
  query: UrlQueryParam[];
}

/**
 * Merge enabled query parameter rows into a base URL, preserving any query
 * string already present in the base URL.
 */
export function buildUrl(opts: BuildUrlOptions): string {
  let { baseUrl } = opts;
  if (!baseUrl) return "";
  const baseWithoutQuery = baseUrl.split("?")[0]!;
  const existingQuery = baseUrl.includes("?") ? baseUrl.split("?").slice(1).join("?") : "";

  const params: string[] = [];
  if (existingQuery) params.push(existingQuery);
  for (const param of opts.query) {
    if (!param.enabled) continue;
    if (!param.key) continue;
    params.push(`${encode(param.key)}=${encode(param.value ?? "")}`);
  }
  const queryString = params.filter(Boolean).join("&");
  return queryString ? `${baseWithoutQuery}?${queryString}` : baseWithoutQuery;
}

function encode(value: string): string {
  // Preserve already-encoded characters while encoding raw values.
  return value.replace(/[^a-zA-Z0-9\-._~!$&'()*+,;=:@/?%]/g, (c) => encodeURIComponent(c));
}

export interface ParsedUrl {
  protocol: string;
  host: string;
  port: string | null;
  path: string;
}

export function parseUrl(raw: string): ParsedUrl {
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port || null,
      path: u.pathname + u.search,
    };
  } catch {
    return { protocol: "", host: "", port: null, path: raw };
  }
}

export function isValidUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}