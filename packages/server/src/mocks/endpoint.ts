import type { Request, Response } from "express";
import { findMockByIdInternal, matchMockRoute } from "../mocks/service.js";
import { logger } from "../logger.js";

/**
 * Public mock endpoint. No authentication by design (mocks emulate a live API).
 * Format: ANY /mock/:mockId[/...path]
 */
export async function mockEndpointHandler(req: Request, res: Response): Promise<void> {
  const segments = ((req.url || "/").split("?")[0] ?? "/").split("/").filter(Boolean);
  const mockId = segments[0] ?? "";
  const mock = findMockByIdInternal(mockId);
  if (!mock) {
    res.status(404).json({ error: "Mock server not found or inactive" });
    return;
  }
  const pathname = "/" + segments.slice(1).join("/");
  if (!pathname) {
    res.status(400).json({ error: "Missing path" });
    return;
  }
  const matched = matchMockRoute(mock, req.method, pathname);
  if (!matched) {
    res.status(404).json({ error: `No mock route matches ${req.method} ${pathname}` });
    return;
  }
  const { response, params } = matched;
  const delayMs = Math.max(0, mock.latency + (response.delayMs ?? 0));

  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }

  // Apply default mock headers + route headers, then substitute path params in body.
  const headers: Record<string, string> = { "Content-Type": "application/json", ...mock.defaultHeaders, ...response.headers };
  const body = substituteParams(response.body, params, mock);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(response.status ?? 200);
  res.send(body);
}

function substituteParams(body: string, params: Record<string, string>, mock: { id: string }): string {
  let out = body;
  for (const [name, value] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\s*\\}\\}`, "g"), value);
  }
  // Support JSON body expressed as an object string replacement.
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function logMockHit(mockId: string, method: string, path: string, status: number): void {
  logger.info("mock hit", { mockId, method, path, status });
}