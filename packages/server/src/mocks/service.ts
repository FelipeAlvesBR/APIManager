import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import { newId, nowIso, ApiError, type MockResponse, type MockRoute } from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { listCollectionRequests } from "../runner/service.js";
import { audit } from "../audit/service.js";

interface MockRow {
  id: string;
  name: string;
  workspace_id: string;
  source_collection_id: string | null;
  routes: string | null;
  latency: number;
  default_headers: string | null;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface Mock {
  id: string;
  name: string;
  workspaceId: string;
  sourceCollectionId?: string;
  routes: MockRoute[];
  latency: number;
  defaultHeaders: Record<string, string>;
  state: string;
  createdAt: string;
  updatedAt: string;
}

function toMock(row: MockRow): Mock {
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
    sourceCollectionId: row.source_collection_id ?? undefined,
    routes: row.routes ? (JSON.parse(row.routes) as MockRoute[]) : [],
    latency: row.latency,
    defaultHeaders: row.default_headers ? JSON.parse(row.default_headers) : {},
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMocks(userId: string, workspaceId: string): Mock[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<MockRow>("SELECT * FROM mocks WHERE workspace_id = ? ORDER BY created_at DESC", workspaceId).map(toMock);
}

export function getMock(userId: string, workspaceId: string, id: string): Mock {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<MockRow>("SELECT * FROM mocks WHERE id = ? AND workspace_id = ?", id, workspaceId);
  if (!row) throw ApiError.notFound("Mock not found");
  return toMock(row);
}

export interface CreateMockInput {
  name: string;
  sourceCollectionId?: string;
  routes?: MockRoute[];
  latency?: number;
  defaultHeaders?: Record<string, string>;
}

export function createMock(userId: string, workspaceId: string, input: CreateMockInput): Mock {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const id = newId("mock");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      "INSERT INTO mocks (id, name, workspace_id, source_collection_id, routes, latency, default_headers, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
      id, input.name.trim(), workspaceId, input.sourceCollectionId ?? null,
      input.routes ? JSON.stringify(input.routes) : null,
      input.latency ?? 0,
      input.defaultHeaders ? JSON.stringify(input.defaultHeaders) : null,
      ts, ts,
    );
    audit(userId, "mock.create", "mock", workspaceId, id, { name: input.name });
  });
  return getMock(userId, workspaceId, id);
}

export function deleteMock(userId: string, workspaceId: string, id: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run("DELETE FROM mocks WHERE id = ? AND workspace_id = ?", id, workspaceId);
  audit(userId, "mock.delete", "mock", workspaceId, id, {});
}

/** Build mock routes from a collection's saved examples. */
export function routesFromCollection(userId: string, workspaceId: string, collectionId: string): MockRoute[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const requests = listCollectionRequests(collectionId);
  const routes: MockRoute[] = [];
  for (const req of requests) {
    const path = extractPath(req.url);
    const examples = queryAll<{ id: string; status: number; status_text: string; headers: string; body: string; name: string }>(
      "SELECT * FROM examples WHERE request_id = ? ORDER BY created_at ASC",
      req.id,
    );
    routes.push({
      id: newId("rte"),
      method: req.method.toUpperCase(),
      path,
      responses: examples.map((e) => ({
        id: e.id,
        name: e.name ?? "Example",
        status: e.status ?? 200,
        statusText: e.status_text ?? "OK",
        headers: e.headers ? JSON.parse(e.headers) : {},
        body: e.body,
        delayMs: 0,
      })),
    });
  }
  return routes;
}

function extractPath(url: string): string {
  const cleaned = url.replace(/\{\{[^}]+\}\}/g, "");
  try {
    const u = new URL(cleaned);
    return u.pathname;
  } catch {
    const withoutQuery = (cleaned.split("?")[0] ?? cleaned);
    return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  }
}

/** Match an incoming mock request against a mock's routes. */
export function matchMockRoute(mock: Mock, method: string, pathname: string): { route: MockRoute; params: Record<string, string>; response: MockResponse } | undefined {
  const methodUpper = method.toUpperCase();
  for (const route of mock.routes) {
    if (route.method.toUpperCase() !== methodUpper) continue;
    const match = matchPath(route.path, pathname);
    if (!match.matched) continue;
    const response = route.responses[0];
    if (!response) continue;
    return { route, params: match.params, response };
  }
  return undefined;
}

export function matchPath(pattern: string, pathname: string): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  // Segments must match in length unless the pattern has a trailing wildcard param.
  if (patternParts.length !== pathParts.length) {
    const last = patternParts[patternParts.length - 1];
    const isWildcard = last === "*" || last === "{*}";
    if (!(isWildcard && pathParts.length >= patternParts.length - 1)) {
      return { matched: false, params: {} };
    }
  }
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i]!;
    const segment = pathParts[i];
    if (p === "*" || p === "{*}") continue;
    if (p.startsWith("{") && p.endsWith("}")) {
      params[p.slice(1, -1)] = segment ?? "";
      continue;
    }
    if (p.startsWith(":")) {
      params[p.slice(1)] = segment ?? "";
      continue;
    }
    if (p !== segment) return { matched: false, params: {} };
  }
  return { matched: true, params };
}

export function findMockByIdInternal(id: string): Mock | undefined {
  const row = queryOne<MockRow>("SELECT * FROM mocks WHERE id = ? AND state = 'active'", id);
  return row ? toMock(row) : undefined;
}