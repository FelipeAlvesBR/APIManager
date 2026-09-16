import type {
  ApiRequest,
  HeaderEntry,
  ResponseSnapshot,
  VariableDefinition,
} from "@apiplatform/shared";
import { config } from "../config.js";
import { buildContext, resolve, type VariableContext } from "../variables/context.js";
import { resolveAuth } from "./auth.js";
import { buildUrl, isValidUrl } from "./url.js";
import { runScript } from "./sandbox.js";

export interface ExecutionDefinition {
  request: ApiRequest;
  workspaceId: string;
  environmentId?: string;
  environmentName?: string;
  environmentVariables: VariableDefinition[];
  collectionVariables: VariableDefinition[];
  globalVariables: VariableDefinition[];
  secrets: Map<string, string>;
  runtime: Record<string, string>;
  data?: Record<string, string>;
  scripts: { prerequest: string[]; test: string[] };
  inheritedHeaders?: HeaderEntry[];
  cookies?: Record<string, string>;
  signal?: AbortSignal;
}

export interface FinalRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | Uint8Array | null;
}

export interface ExecutionResult {
  response: ResponseSnapshot;
  finalRequest: FinalRequest;
  runtime: Record<string, string>;
  environment: Record<string, string>;
  collection: Record<string, string>;
  globals: Record<string, string>;
  cookies: Record<string, string>;
  preScriptError?: string;
  postScriptError?: string;
}

function mapVars(defs: VariableDefinition[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) if (d.enabled) out[d.name] = d.value;
  return out;
}

function syncRuntime(ctx: VariableContext, runtime: Record<string, string>): void {
  // Rebuild runtime sources from the mutable runtime map.
  const others = ctx.sources.filter((s) => s.scope !== "runtime");
  const merged = [
    ...Object.entries(runtime).map(([name, value]) => ({
      name, value, scope: "runtime" as const, secret: false, enabled: true,
    })),
    ...others,
  ];
  ctx.sources = merged;
  ctx.runtime = runtime;
}

/**
 * Execute a request through the full pipeline: variable resolution -> validation
 * -> pre-request scripts -> auth -> network -> post-response scripts -> assertions.
 */
export async function executeRequest(def: ExecutionDefinition): Promise<ExecutionResult> {
  const ctx: VariableContext = buildContext({
    runtime: def.runtime,
    data: def.data,
    environment: def.environmentVariables,
    collection: def.collectionVariables,
    globals: def.globalVariables,
    secretNames: new Set(def.secrets.keys()),
  });

  const runtime: Record<string, string> = { ...def.runtime };
  const environment = mapVars(def.environmentVariables);
  const collection = mapVars(def.collectionVariables);
  const globals = mapVars(def.globalVariables);
  const cookies = { ...(def.cookies ?? {}) };

  const scriptEnv = { ...environment };
  const scriptCollection = { ...collection };
  const scriptGlobals = { ...globals };

  let preScriptError: string | undefined;

  // --- Pre-request scripts (collection -> folder -> request order implied by caller) ---
  for (const code of def.scripts.prerequest) {
    if (!code) continue;
    const payload = {
      code,
      timeoutMs: config.execution.scriptTimeoutMs,
      request: { method: def.request.method, url: def.request.url, headers: {}, body: undefined },
      response: { status: null, statusText: "", headers: {}, body: "", responseTime: 0 },
      state: {
        runtime,
        environment: scriptEnv,
        collection: scriptCollection,
        globals: scriptGlobals,
        environmentName: def.environmentName,
        cookies,
        secretNames: [...def.secrets.keys()],
      },
      sendRequestAllowed: true,
    };
    const result = await runScript(payload);
    if (!result.ok) {
      preScriptError = result.error;
      if (def.request.settings?.retryCount) break;
      // Continue or abort per configured policy: default abort on script error.
    }
    Object.assign(runtime, result.runtime);
    Object.assign(scriptEnv, result.environment);
    Object.assign(scriptCollection, result.collection);
    Object.assign(scriptGlobals, result.globals);
    Object.assign(cookies, result.cookies);
    Object.assign(environment, result.environment);
    Object.assign(collection, result.collection);
    Object.assign(globals, result.globals);
    syncRuntime(ctx, runtime);
    if (preScriptError) break;
  }

  const resolveFn = (value: string) => resolve(value, ctx, def.secrets).value;

  // --- Validation ---
  const resolvedQuery = (def.request.query ?? [])
    .filter((q) => q.enabled && q.key)
    .map((q) => ({ ...q, key: resolveFn(q.key), value: resolveFn(q.value ?? "") }));
  const urlWithQuery = buildUrl({ baseUrl: resolveFn(def.request.url), query: resolvedQuery });
  if (!isValidUrl(urlWithQuery)) {
    const error = `Malformed or unsupported URL: ${urlWithQuery}`;
    const snap = errorSnapshot("ERR_INVALID_URL", error, def.request, 0);
    return {
      response: snap,
      finalRequest: { method: def.request.method, url: urlWithQuery, headers: {}, body: null },
      runtime,
      environment,
      collection,
      globals,
      cookies,
      preScriptError,
      postScriptError: error,
    };
  }

  // --- Headers ---
  const finalHeaders: Record<string, string> = {};
  const inherited = def.inheritedHeaders ?? [];
  for (const source of [...inherited, ...(def.request.header ?? [])]) {
    if (!source.enabled) continue;
    if (!source.key) continue;
    finalHeaders[source.key] = resolveFn(source.value ?? "");
  }

  // --- Body ---
  const bodyMeta = resolveBodyString(def.request, resolveFn, def.secrets) ?? { body: null, contentType: null };
  if (bodyMeta.contentType && !hasHeader(finalHeaders, "content-type")) {
    finalHeaders["Content-Type"] = bodyMeta.contentType;
  }

  // --- Auth ---
  let authResolved;
  try {
    authResolved = resolveAuth(def.request.auth, resolveFn);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      response: errorSnapshot("AUTH_ERROR", message, def.request, 0),
      finalRequest: { method: def.request.method, url: urlWithQuery, headers: finalHeaders, body: bodyMeta.body },
      runtime, environment, collection, globals, cookies,
      preScriptError,
      postScriptError: message,
    };
  }
  for (const [k, v] of Object.entries(authResolved.headers)) finalHeaders[k] = v;

  // Merge auth query params into URL.
  let finalUrl = urlWithQuery;
  if (authResolved.query && Object.keys(authResolved.query).length) {
    const sep = finalUrl.includes("?") ? "&" : "?";
    finalUrl += sep + Object.entries(authResolved.query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  }

  const finalRequest: FinalRequest = {
    method: def.request.method.toUpperCase(),
    url: finalUrl,
    headers: finalHeaders,
    body: bodyMeta.body,
  };

  // --- Network execution ---
  const response = await executeNetwork(finalRequest, def);

  // --- Post-response scripts (tests) ---
  let postScriptError: string | undefined;
  const postLogs = [];
  const postTests = [];
  for (const code of def.scripts.test) {
    if (!code) continue;
    syncRuntime(ctx, runtime);
    const finalEnv2 = { ...environment, ...scriptEnv };
    const payload = {
      code,
      timeoutMs: config.execution.scriptTimeoutMs,
      request: {
        method: finalRequest.method,
        url: finalRequest.url,
        headers: finalHeaders,
        body: typeof finalRequest.body === "string" ? finalRequest.body : undefined,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        responseTime: response.durationMs,
      },
      state: {
        runtime,
        environment: finalEnv2,
        collection: scriptCollection,
        globals: scriptGlobals,
        environmentName: def.environmentName,
        cookies,
        secretNames: [...def.secrets.keys()],
      },
      sendRequestAllowed: true,
    };
    const result = await runScript(payload);
    if (!result.ok) postScriptError = result.error;
    for (const t of result.tests) postTests.push(t);
    for (const l of result.logs) postLogs.push(l);
    Object.assign(runtime, result.runtime);
    Object.assign(scriptEnv, result.environment);
    Object.assign(scriptCollection, result.collection);
    Object.assign(scriptGlobals, result.globals);
    Object.assign(cookies, result.cookies);
    Object.assign(environment, result.environment);
    Object.assign(collection, result.collection);
    Object.assign(globals, result.globals);
  }

  response.tests = postTests;
  response.logs = postLogs;
  response.console = postLogs;

  return {
    response,
    finalRequest,
    runtime: { ...runtime },
    environment,
    collection,
    globals,
    cookies,
    preScriptError,
    postScriptError,
  };
}

function resolveBodyString(def: ExecutionDefinition["request"], resolveFn: (s: string) => string, _secrets: Map<string, string>) {
  const b = def.body;
  if (!b || b.mode === "none") return null;
  if (b.mode === "raw" || b.mode === "javascript" || b.mode === "html" || b.mode === "xml") {
    const raw = resolveFn(b.raw ?? "");
    return { body: raw, contentType: contentTypeForMode(b.mode) };
  }
  if (b.mode === "json") {
    const json = resolveFn(b.json ?? "");
    return { body: json, contentType: "application/json" };
  }
  if (b.mode === "graphql") {
    const query = resolveFn(b.graphql?.query ?? "");
    const variables = b.graphql?.variables ? resolveFn(b.graphql.variables) : undefined;
    return { body: JSON.stringify({ query, variables: variables ? safeParse(variables) : undefined }), contentType: "application/json" };
  }
  if (b.mode === "urlencoded") {
    const params = (b.urlencoded ?? [])
      .filter((e) => e.enabled && e.key)
      .map((e) => `${encodeURIComponent(resolveFn(e.key))}=${encodeURIComponent(resolveFn(e.value ?? ""))}`);
    return { body: params.join("&"), contentType: "application/x-www-form-urlencoded" };
  }
  if (b.mode === "formdata") {
    return buildMultipartResolved(b.formdata ?? [], resolveFn);
  }
  if (b.mode === "binary") {
    const raw = b.binary ?? "";
    return { body: safeDecodeBase64(raw), contentType: "application/octet-stream" };
  }
  return null;
}

function contentTypeForMode(mode: string): string {
  if (mode === "html") return "text/html";
  if (mode === "javascript") return "application/javascript";
  if (mode === "xml") return "application/xml";
  return "text/plain";
}

function safeParse(v: string): unknown {
  try { return JSON.parse(v); } catch { return v; }
}

function safeDecodeBase64(raw: string): Buffer {
  const cleaned = raw.includes(",") ? raw.split(",").slice(1).join(",") : raw;
  try { return Buffer.from(cleaned, "base64"); } catch { return Buffer.alloc(0); }
}

function buildMultipartResolved(fields: { enabled: boolean; key: string; value?: string; type?: string; fileName?: string; contentType?: string }[], resolveFn: (s: string) => string) {
  const boundary = `----apiplatform-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const f of fields) {
    if (!f.enabled || !f.key) continue;
    const key = resolveFn(f.key);
    const fileName = f.fileName ? resolveFn(f.fileName) : undefined;
    const disposition = fileName
      ? `Content-Disposition: form-data; name="${key.replace(/"/g, '\\"')}"; filename="${fileName.replace(/"/g, '\\"')}"`
      : `Content-Disposition: form-data; name="${key.replace(/"/g, '\\"')}"`;
    chunks.push(Buffer.from(`--${boundary}\r\n${disposition}\r\n`));
    if (fileName && f.contentType) chunks.push(Buffer.from(`Content-Type: ${f.contentType}\r\n`));
    chunks.push(Buffer.from("\r\n"));
    chunks.push(fileName ? safeDecodeBase64(resolveFn(f.value ?? "")) : Buffer.from(resolveFn(f.value ?? ""), "utf8"));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: new Uint8Array(Buffer.concat(chunks)), contentType: `multipart/form-data; boundary=${boundary}` };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const keys = Object.keys(headers).map((k) => k.toLowerCase());
  return keys.includes(name.toLowerCase());
}

async function executeNetwork(
  finalRequest: FinalRequest,
  def: ExecutionDefinition,
): Promise<ResponseSnapshot> {
  const started = performance.now();
  const maxRedirects = def.request.settings?.maxRedirects ?? config.execution.maxRedirects;
  const followRedirects = def.request.settings?.followRedirects ?? true;
  const timeoutMs = def.request.settings?.timeoutMs ?? config.execution.timeoutMs;

  let currentUrl = finalRequest.url;
  let currentMethod = finalRequest.method;
  let currentHeaders = { ...finalRequest.headers };
  let currentBody = finalRequest.body;
  const redirectedUrls: string[] = [];

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(timeoutMs);
    const onAbort = () => controller.abort(def.signal?.reason);
    def.signal?.addEventListener("abort", onAbort, { once: true });
    const combined = AbortSignal.any([controller.signal, timeout]);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: currentMethod,
        headers: currentHeaders,
        body: currentBody ? (currentBody as RequestInit["body"]) : undefined,
        signal: combined,
        redirect: "manual",
      });
    } catch (err) {
      def.signal?.removeEventListener("abort", onAbort);
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      const isAbort = def.signal?.aborted;
      return errorSnapshot(
        isAbort ? "ABORTED" : isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        isAbort ? "Request was aborted" : isTimeout ? `Request timed out after ${timeoutMs}ms` : err instanceof Error ? err.message : String(err),
        def.request,
        Math.round(performance.now() - started),
      );
    }
    def.signal?.removeEventListener("abort", onAbort);

    const status = res.status;
    const isRedirect = status >= 300 && status < 400;

    if (followRedirects && isRedirect) {
      const location = res.headers.get("location");
      if (!location) {
        return readResponse(def.request, res, started);
      }
      redirectedUrls.push(currentUrl);
      const next = new URL(location, currentUrl).toString();
      if (redirectedUrls.includes(next) || redirectedUrls.length > maxRedirects) {
        return errorSnapshot("REDIRECT_LOOP", `Redirect loop or too many redirects (>${maxRedirects})`, def.request, Math.round(performance.now() - started));
      }
      const preserveMethod = def.request.settings?.followOriginalMethod ?? false;
      currentUrl = next;
      if (!preserveMethod && status === 303) {
        currentMethod = "GET";
        currentBody = null;
      } else if (!preserveMethod && status === 302) {
        currentMethod = "GET";
        currentBody = null;
      }
      // Drop content-type / content-length on redirect.
      if (!preserveMethod) {
        const stripped: Record<string, string> = {};
        for (const [k, v] of Object.entries(currentHeaders)) {
          const lk = k.toLowerCase();
          if (lk === "content-type" || lk === "content-length" || lk === "authorization") continue;
          stripped[k] = v;
        }
        currentHeaders = stripped;
      }
      continue;
    }

    const snapshot = await readResponse(def.request, res, started);
    snapshot.redirectedUrls = redirectedUrls;
    if (res.url) snapshot.remoteAddress = new URL(res.url).hostname;
    return snapshot;
  }

  return errorSnapshot("REDIRECT_LOOP", `Too many redirects (max ${maxRedirects})`, def.request, Math.round(performance.now() - started));
}

async function readResponse(request: ApiRequest, res: Response, started: number): Promise<ResponseSnapshot> {
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const sizeBytes = bytes.byteLength;
  const maxCapture = config.execution.maxResponseCaptureBytes;
  const truncated = sizeBytes > maxCapture;
  const captured = truncated ? bytes.slice(0, maxCapture) : bytes;

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const cookies: Record<string, string> = {};
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    const first = cookie.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq > 0) cookies[first.slice(0, eq)] = first.slice(eq + 1);
  }

  const body = new TextDecoder().decode(captured);

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    cookies,
    body: truncated ? body + `\n\n… truncated (${sizeBytes} bytes total)` : body,
    sizeBytes,
    durationMs: Math.round(performance.now() - started),
    requestId: request.id,
    protocol: new URL(res.url).protocol.replace(":", ""),
    tests: [],
    logs: [],
    console: [],
  };
}

function errorSnapshot(code: string, message: string, request: ApiRequest, duration: number): ResponseSnapshot {
  return {
    status: null,
    statusText: "",
    headers: {},
    cookies: {},
    body: "",
    sizeBytes: 0,
    durationMs: duration,
    requestId: request.id,
    error: { code, message },
    tests: [],
    logs: [],
    console: [],
  };
}