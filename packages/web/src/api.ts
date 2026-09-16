import type {
  ApiRequest,
  Collection,
  Environment,
  HistoryEntry,
  ResponseSnapshot,
  VariableDefinition,
  AiProvider,
  CollectionFolder,
} from "@apiplatform/shared";

const TOKEN_KEY = "apiplatform.token";
const USER_KEY = "apiplatform.user";

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): unknown {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.error?.message ?? res.statusText;
    throw new ApiError(res.status, data?.error?.code ?? "ERROR", message);
  }
  return data as T;
}

export const api = {
  // Auth
  register: (input: { email: string; name: string; password: string }) =>
    request<{ token: string; user: unknown }>("POST", "/api/auth/register", input),
  login: (input: { email: string; password: string }) =>
    request<{ token: string; user: unknown }>("POST", "/api/auth/login", input),
  me: () => request<{ user: unknown }>("GET", "/api/auth/me"),

  // Workspaces
  listWorkspaces: () => request<{ workspaces: Record<string, unknown>[] }>("GET", "/api/workspaces"),
  createWorkspace: (input: { name: string; description?: string; visibility?: string }) =>
    request<{ workspace: Record<string, unknown> }>("POST", "/api/workspaces", input),

  // Collections
  listCollections: (ws: string) => request<{ collections: Collection[] }>("GET", `/api/collections/${ws}`),
  createCollection: (ws: string, input: { name: string; description?: string }) =>
    request<{ collection: Collection }>("POST", `/api/collections/${ws}`, input),
  getCollection: (ws: string, id: string) =>
    request<{ collection: Collection; folders: CollectionFolder[]; requests: ApiRequest[] }>("GET", `/api/collections/${ws}/${id}`),
  createFolder: (ws: string, col: string, input: { name: string; parentFolderId?: string | null }) =>
    request<{ folder: CollectionFolder }>("POST", `/api/collections/${ws}/${col}/folders`, input),

  // Requests
  listRequests: (ws: string) => request<{ requests: ApiRequest[] }>("GET", `/api/requests/${ws}`),
  createRequest: (ws: string, input: Partial<ApiRequest>) =>
    request<{ request: ApiRequest }>("POST", `/api/requests/${ws}`, input),
  getRequest: (ws: string, id: string) => request<{ request: ApiRequest }>("GET", `/api/requests/${ws}/${id}`),
  updateRequest: (ws: string, id: string, input: Partial<ApiRequest>) =>
    request<{ request: ApiRequest }>("PATCH", `/api/requests/${ws}/${id}`, input),
  deleteRequest: (ws: string, id: string) => request<{ ok: boolean }>("DELETE", `/api/requests/${ws}/${id}`),
  duplicateRequest: (ws: string, id: string) =>
    request<{ request: ApiRequest }>("POST", `/api/requests/${ws}/${id}/duplicate`),
  sendRequest: (ws: string, id: string, input: { environmentId?: string; runtime?: Record<string, string>; saveAsExample?: boolean }) =>
    request<{ response: ResponseSnapshot; request: Record<string, unknown>; tests: unknown[]; example?: unknown }>(
      "POST",
      `/api/requests/${ws}/${id}/send`,
      input,
    ),

  // Environments
  listEnvironments: (ws: string) => request<{ environments: Environment[] }>("GET", `/api/environments/${ws}`),
  createEnvironment: (ws: string, input: { name: string; variables?: VariableDefinition[] }) =>
    request<{ environment: Environment }>("POST", `/api/environments/${ws}`, input),
  updateEnvironment: (ws: string, id: string, input: { name?: string; variables?: VariableDefinition[] }) =>
    request<{ environment: Environment }>("PATCH", `/api/environments/${ws}/${id}`, input),
  getGlobals: (ws: string) => request<{ variables: VariableDefinition[] }>("GET", `/api/environments/${ws}/globals`),
  setGlobals: (ws: string, variables: VariableDefinition[]) =>
    request<{ variables: VariableDefinition[] }>("PUT", `/api/environments/${ws}/globals`, { variables }),

  // Secrets
  listSecrets: (ws: string) => request<{ secrets: { id: string; key: string; updatedAt: string }[] }>("GET", `/api/environments/${ws}/secrets`),
  setSecret: (ws: string, key: string, value: string) =>
    request<{ secret: unknown }>("PUT", `/api/environments/${ws}/secrets/${key}`, { value }),

  // History
  listHistory: (ws: string, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(filters);
    return request<{ entries: HistoryEntry[] }>("GET", `/api/history/${ws}?${params.toString()}`);
  },

  // Examples
  listExamples: (ws: string, requestId: string) => request<{ examples: unknown[] }>("GET", `/api/examples/${ws}/${requestId}`),

  // Runs
  runCollection: (ws: string, input: Record<string, unknown>) => request<Record<string, unknown>>("POST", `/api/runs/${ws}`, input),
  listRuns: (ws: string) => request<{ runs: unknown[] }>("GET", `/api/runs/${ws}`),

  // Mocks
  listMocks: (ws: string) => request<{ mocks: unknown[] }>("GET", `/api/mocks/${ws}`),
  createMock: (ws: string, input: Record<string, unknown>) => request<{ mock: unknown }>("POST", `/api/mocks/${ws}`, input),

  // Monitors
  listMonitors: (ws: string) => request<{ monitors: unknown[] }>("GET", `/api/monitors/${ws}`),
  createMonitor: (ws: string, input: Record<string, unknown>) => request<{ monitor: unknown }>("POST", `/api/monitors/${ws}`, input),

  // Specs
  listSpecs: (ws: string) => request<{ specs: unknown[] }>("GET", `/api/specs/${ws}`),
  validateSpec: (ws: string, content: string, format: string) =>
    request<Record<string, unknown>>("POST", `/api/specs/${ws}/validate`, { content, format }),

  // Import / export / codegen
  importData: (ws: string, input: { type: string; content: string }) =>
    request<Record<string, unknown>>("POST", `/api/import/${ws}`, input),
  exportCollection: (ws: string, collectionId: string) =>
    fetch(`/api/export/${ws}/${collectionId}`, { headers: authHeaders() }).then((r) => r.text()),
  codegen: (ws: string, input: Record<string, unknown>) =>
    request<{ snippet: string }>("POST", `/api/codegen/${ws}`, input),

  // AI
  listProviders: (ws: string) => request<{ providers: AiProvider[] }>("GET", `/api/ai/${ws}/providers`),
  createProvider: (ws: string, input: Record<string, unknown>) =>
    request<{ provider: AiProvider }>("POST", `/api/ai/${ws}/providers`, input),
  testProvider: (ws: string, providerId: string) =>
    request<{ checks: { name: string; ok: boolean; detail: string }[]; overall: boolean }>("POST", `/api/ai/${ws}/providers/${providerId}/test`),
  chat: (ws: string, input: { providerId: string; messages: { role: string; content: string }[]; redact?: boolean }) =>
    request<{ content: string; redacted: boolean }>("POST", `/api/ai/${ws}/chat`, input),
  getPolicy: (ws: string) => request<{ policy: Record<string, unknown> }>("GET", `/api/ai/${ws}/policy`),
  setPolicy: (ws: string, input: Record<string, unknown>) =>
    request<{ policy: Record<string, unknown> }>("PUT", `/api/ai/${ws}/policy`, input),
};