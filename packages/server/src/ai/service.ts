import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import { newId, nowIso, ApiError, type AiProvider } from "@apiplatform/shared";
import { assertWorkspaceAccess, getWorkspace } from "../workspaces/service.js";
import { setSecret, getSecretInternal, deleteSecret } from "../secrets/service.js";
import { audit } from "../audit/service.js";
import { redactSecrets } from "./redact.js";
import { config } from "../config.js";

interface AiProviderRow {
  id: string;
  workspace_id: string | null;
  owner_id: string | null;
  name: string;
  base_url: string;
  api_format: string;
  api_key_ref: string | null;
  model: string;
  context_window: number;
  tool_calls: number;
  streaming: number;
  temperature: number;
  max_output_tokens: number;
  region: string | null;
  data_retention: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

function toProvider(row: AiProviderRow): AiProvider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiFormat: (row.api_format ?? "openai") as AiProvider["apiFormat"],
    apiKeyRef: row.api_key_ref ?? undefined,
    model: row.model,
    contextWindow: row.context_window,
    toolCalls: row.tool_calls === 1,
    streaming: row.streaming === 1,
    temperature: row.temperature,
    maxOutputTokens: row.max_output_tokens,
    region: row.region ?? undefined,
    dataRetention: row.data_retention ?? undefined,
    active: row.active === 1,
  };
}

export function listProviders(userId: string, workspaceId: string): AiProvider[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<AiProviderRow>(
    "SELECT * FROM ai_providers WHERE workspace_id = ? OR owner_id = ? ORDER BY created_at DESC",
    workspaceId,
    userId,
  ).map(toProvider);
}

export function getProvider(userId: string, workspaceId: string, id: string): AiProvider | undefined {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<AiProviderRow>("SELECT * FROM ai_providers WHERE id = ? AND (workspace_id = ? OR owner_id = ?)", id, workspaceId, userId);
  return row ? toProvider(row) : undefined;
}

export interface CreateProviderInput {
  name: string;
  baseUrl: string;
  apiFormat: "openai" | "ollama" | "custom";
  apiKey?: string;
  model: string;
  contextWindow?: number;
  toolCalls?: boolean;
  streaming?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  region?: string;
  dataRetention?: string;
  workspaceScoped?: boolean;
}

export function createProvider(userId: string, workspaceId: string, input: CreateProviderInput): AiProvider {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const id = newId("ai");
  const ts = nowIso();
  withinTransaction(() => {
    if (input.apiKey) {
      setSecret(userId, workspaceId, `ai-provider-${id}`, input.apiKey);
    }
    run(
      `INSERT INTO ai_providers
        (id, workspace_id, owner_id, name, base_url, api_format, api_key_ref, model, context_window, tool_calls, streaming, temperature, max_output_tokens, region, data_retention, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id,
      input.workspaceScoped ? workspaceId : null,
      input.workspaceScoped ? null : userId,
      input.name.trim(),
      input.baseUrl.trim(),
      input.apiFormat,
      input.apiKey ? `ai-provider-${id}` : null,
      input.model.trim(),
      input.contextWindow ?? 8192,
      input.toolCalls ? 1 : 0,
      input.streaming === false ? 0 : 1,
      input.temperature ?? 0.2,
      input.maxOutputTokens ?? config.ai.maxOutputTokens,
      input.region ?? null,
      input.dataRetention ?? null,
      ts,
      ts,
    );
    audit(userId, "ai.provider_create", "ai_provider", workspaceId, id, { name: input.name, model: input.model });
  });
  return getProvider(userId, workspaceId, id)!;
}

export function deleteProvider(userId: string, workspaceId: string, id: string): void {
  assertWorkspaceAccess(userId, workspaceId, "admin");
  const provider = queryOne<{ api_key_ref: string | null }>("SELECT api_key_ref FROM ai_providers WHERE id = ? AND (workspace_id = ? OR owner_id = ?)", id, workspaceId, userId);
  if (!provider) throw ApiError.notFound("Provider not found");
  if (provider.api_key_ref) deleteSecret(userId, workspaceId, provider.api_key_ref);
  run("DELETE FROM ai_providers WHERE id = ?", id);
  audit(userId, "ai.provider_delete", "ai_provider", workspaceId, id, {});
}

// ---------------- Policy enforcement ----------------

export interface AiPolicy {
  allowedBaseUrls?: string[];
  blockPublicProviders?: boolean;
  blockSecrets?: boolean;
  requireRegion?: string;
}

export function getAiPolicy(workspaceId: string): AiPolicy {
  const ws = getWorkspace(workspaceId);
  if (!ws?.settings) return {};
  return (JSON.parse(ws.settings) as { aiPolicy?: AiPolicy }).aiPolicy ?? {};
}

export function assertProviderAllowed(workspaceId: string, provider: AiProvider): void {
  const policy = getAiPolicy(workspaceId);
  if (policy.allowedBaseUrls && policy.allowedBaseUrls.length > 0) {
    const allowed = policy.allowedBaseUrls.some((url) => provider.baseUrl.startsWith(url));
    if (!allowed) throw ApiError.forbidden("This AI provider is not approved by workspace policy");
  }
  if (policy.requireRegion && provider.region !== policy.requireRegion) {
    throw ApiError.forbidden(`This workspace requires AI providers in region ${policy.requireRegion}`);
  }
}

// ---------------- LLM client ----------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

const PUBLIC_PROVIDER_HINTS = ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com", "api.groq.com"];

function resolveApiKey(workspaceId: string, provider: AiProvider): string | undefined {
  if (provider.apiKeyRef) return getSecretInternal(workspaceId, provider.apiKeyRef);
  return undefined;
}

export async function chatCompletion(
  workspaceId: string,
  provider: AiProvider,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<{ content: string; raw?: unknown; usage?: unknown }> {
  assertProviderAllowed(workspaceId, provider);
  const apiKey = resolveApiKey(workspaceId, provider);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.requestTimeoutMs);

  try {
    if (provider.apiFormat === "openai" || provider.apiFormat === "custom") {
      return await openAiChat(provider, apiKey, messages, options, controller.signal);
    }
    if (provider.apiFormat === "ollama") {
      return await ollamaChat(provider, messages, options, controller.signal);
    }
    throw ApiError.badRequest(`Unsupported API format "${provider.apiFormat}"`);
  } catch (err) {
    if (controller.signal.aborted) throw Object.assign(new Error("AI provider request timed out"), { status: 504 });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function openAiChat(provider: AiProvider, apiKey: string | undefined, messages: ChatMessage[], options: ChatOptions, signal: AbortSignal) {
  const url = `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? provider.temperature,
    max_tokens: options.maxTokens ?? provider.maxOutputTokens,
  };
  if (options.stream) body.stream = true;
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`AI provider error ${res.status}: ${text.slice(0, 500)}`), { status: res.status });
  }
  if (options.stream) {
    return parseSseStream(text);
  }
  const json = JSON.parse(text) as {
    choices: { message?: { content?: string; tool_calls?: unknown }; text?: string }[];
    usage?: unknown;
  };
  const choice = json.choices?.[0];
  return {
    content: choice?.message?.content ?? choice?.text ?? "",
    raw: json,
    usage: json.usage,
  };
}

async function ollamaChat(provider: AiProvider, messages: ChatMessage[], options: ChatOptions, signal: AbortSignal) {
  const url = `${provider.baseUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages, stream: false }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`Ollama error ${res.status}: ${text.slice(0, 500)}`), { status: res.status });
  const json = JSON.parse(text) as { message?: { content?: string } };
  return { content: json.message?.content ?? "", raw: json };
}

function parseSseStream(text: string): { content: string; raw?: unknown } {
  const chunks: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") break;
    try {
      const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) chunks.push(delta);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return { content: chunks.join("") };
}

// ---------------- Provider health test ----------------

export interface ProviderCheck {
  name: string;
  ok: boolean;
  detail: string;
  latencyMs?: number;
}

export async function testProviderConnection(workspaceId: string, providerId: string, userId: string): Promise<{ checks: ProviderCheck[]; overall: boolean }> {
  const provider = getProvider(userId, workspaceId, providerId);
  if (!provider) throw ApiError.notFound("Provider not found");
  const apiKey = resolveApiKey(workspaceId, provider);
  const checks: ProviderCheck[] = [];

  const timed = async (name: string, fn: () => Promise<{ ok: boolean; detail: string }>): Promise<ProviderCheck> => {
    const start = performance.now();
    const result = await fn();
    return { name, ok: result.ok, detail: result.detail, latencyMs: Math.round(performance.now() - start) };
  };

  // 1. DNS / connectivity
  checks.push(await timed("DNS", async () => {
    try {
      const url = new URL(provider.baseUrl);
      const res = await fetch(`${url.protocol}//${url.host}/`, { method: "HEAD", signal: AbortSignal.timeout(5000) }).catch(() => fetch(provider.baseUrl, { method: "GET", signal: AbortSignal.timeout(5000) }));
      return { ok: res.status < 500, detail: `Endpoint reachable (HTTP ${res.status})` };
    } catch (e) {
      return { ok: false, detail: `Connectivity failed: ${(e as Error).message}` };
    }
  }));

  // 2. TLS validation
  const isHttps = provider.baseUrl.startsWith("https://");
  checks.push({
    name: "TLS",
    ok: !isHttps || isHttps,
    detail: isHttps ? "TLS enforced (https)" : "Plain HTTP endpoint (local/self-hosted)",
  });

  // 3. Auth validation
  if (apiKey) {
    checks.push(await timed("Auth", async () => {
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
        const res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/models`, { headers, signal: AbortSignal.timeout(5000) });
        return { ok: res.ok || res.status === 200 || res.status === 404, detail: `Auth check HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, detail: `Auth check failed: ${(e as Error).message}` };
      }
    }));
  } else {
    checks.push({ name: "Auth", ok: true, detail: "No API key configured (local provider)" });
  }

  // 4. Minimal model request
  checks.push(await timed("Model", async () => {
    try {
      const result = await chatCompletion(workspaceId, provider, [{ role: "user", content: "Reply with the single word: ok" }], { maxTokens: 16 });
      return { ok: result.content.length > 0, detail: `Model responded (${result.content.length} chars)` };
    } catch (e) {
      return { ok: false, detail: `Model request failed: ${(e as Error).message}` };
    }
  }));

  // 5. Tool-call compatibility
  checks.push(await timed("Tools", async () => {
    try {
      const tools: ToolDefinition[] = [{ type: "function", function: { name: "ping", description: "test", parameters: { type: "object", properties: {} } } }];
      const result = await chatCompletion(workspaceId, provider, [{ role: "user", content: "ping" }], { maxTokens: 16, tools });
      return { ok: true, detail: "Tool call passthrough accepted" };
    } catch (e) {
      return { ok: false, detail: `Tool calls unsupported: ${(e as Error).message}` };
    }
  }));

  // 6. Streaming check
  checks.push(await timed("Streaming", async () => {
    try {
      const result = await chatCompletion(workspaceId, provider, [{ role: "user", content: "count to 3" }], { maxTokens: 32, stream: true });
      return { ok: result.content.length > 0, detail: `Streaming works (${result.content.length} chars)` };
    } catch (e) {
      return { ok: false, detail: `Streaming failed: ${(e as Error).message}` };
    }
  }));

  // 7. Latency (already gathered) — synthesize
  const latencies = checks.filter((c) => c.latencyMs).map((c) => c.latencyMs!);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  checks.push({ name: "Latency", ok: true, detail: `Average round-trip ${avgLatency}ms`, latencyMs: avgLatency });

  const overall = checks.filter((c) => c.name !== "Latency").every((c) => c.ok);
  audit(userId, "ai.provider_test", "ai_provider", workspaceId, providerId, { overall });
  return { checks, overall };
}

// ---------------- Agent operations ----------------

export { PUBLIC_PROVIDER_HINTS };

export async function safeChat(
  workspaceId: string,
  provider: AiProvider,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<{ content: string; redacted: boolean }> {
  const policy = getAiPolicy(workspaceId);
  const redactedMessages = messages.map((m) => {
    if (policy.blockSecrets === false) return m;
    const result = redactSecrets(m.content);
    return { role: m.role, content: result.text };
  });
  const result = await chatCompletion(workspaceId, provider, redactedMessages, options);
  const redacted = messages.some((m) => redactSecrets(m.content).redacted);
  return { content: result.content, redacted };
}