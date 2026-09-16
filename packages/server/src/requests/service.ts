import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import {
  ApiError,
  newId,
  nowIso,
  type ApiRequest,
  type AuthConfig,
  type HeaderEntry,
  type RequestBody,
  type RequestSettings,
  type UrlQueryParam,
} from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";

interface RequestRow {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string;
  headers: string | null;
  query: string | null;
  body: string | null;
  auth: string | null;
  settings: string | null;
  prerequest_script: string | null;
  test_script: string | null;
  collection_id: string | null;
  folder_id: string | null;
  workspace_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export function toRequest(row: RequestRow): ApiRequest {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    method: row.method,
    url: row.url,
    header: row.headers ? (JSON.parse(row.headers) as HeaderEntry[]) : [],
    query: row.query ? (JSON.parse(row.query) as UrlQueryParam[]) : [],
    body: row.body ? (JSON.parse(row.body) as RequestBody) : undefined,
    auth: row.auth ? (JSON.parse(row.auth) as AuthConfig) : undefined,
    settings: row.settings ? (JSON.parse(row.settings) as RequestSettings) : undefined,
    events:
      row.prerequest_script || row.test_script
        ? { prerequest: row.prerequest_script ?? undefined, test: row.test_script ?? undefined }
        : undefined,
    collectionId: row.collection_id ?? undefined,
    folderId: row.folder_id ?? undefined,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function getRequest(userId: string, workspaceId: string, id: string): ApiRequest {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<RequestRow>("SELECT * FROM requests WHERE id = ? AND workspace_id = ?", id, workspaceId);
  if (!row) throw ApiError.notFound("Request not found");
  return toRequest(row);
}

export function listRequests(userId: string, workspaceId: string, collectionId?: string): ApiRequest[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const rows = collectionId
    ? queryAll<RequestRow>(
        "SELECT * FROM requests WHERE workspace_id = ? AND collection_id = ? ORDER BY sort_order ASC, name ASC",
        workspaceId,
        collectionId,
      )
    : queryAll<RequestRow>(
        "SELECT * FROM requests WHERE workspace_id = ? ORDER BY sort_order ASC, name ASC",
        workspaceId,
      );
  return rows.map(toRequest);
}

export interface SaveRequestInput {
  name: string;
  description?: string;
  method: string;
  url: string;
  header?: HeaderEntry[];
  query?: UrlQueryParam[];
  body?: RequestBody;
  auth?: AuthConfig | null;
  settings?: RequestSettings;
  events?: { prerequest?: string; test?: string };
  collectionId?: string;
  folderId?: string | null;
}

export function createRequest(userId: string, workspaceId: string, input: SaveRequestInput): ApiRequest {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const method = (input.method || "GET").toUpperCase();
  if (!input.url) throw ApiError.badRequest("A URL is required");

  if (input.collectionId) {
    const col = queryOne<{ id: string }>("SELECT id FROM collections WHERE id = ? AND workspace_id = ?", input.collectionId, workspaceId);
    if (!col) throw ApiError.badRequest("Collection does not exist in this workspace");
  }

  const id = newId("req");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      `INSERT INTO requests
        (id, name, description, method, url, headers, query, body, auth, settings, prerequest_script, test_script, collection_id, folder_id, workspace_id, sort_order, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      id, input.name.trim(), input.description ?? "", method, input.url, JSON.stringify(input.header ?? []),
      JSON.stringify(input.query ?? []), input.body ? JSON.stringify(input.body) : null,
      input.auth ? JSON.stringify(input.auth) : null,
      input.settings ? JSON.stringify(input.settings) : null,
      input.events?.prerequest ?? null, input.events?.test ?? null,
      input.collectionId ?? null, input.folderId ?? null, workspaceId, ts, ts,
    );
    audit(userId, "request.create", "request", workspaceId, id, { name: input.name, method });
  });
  return getRequest(userId, workspaceId, id);
}

export function updateRequest(userId: string, workspaceId: string, id: string, input: SaveRequestInput): ApiRequest {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const current = getRequest(userId, workspaceId, id);
  const method = (input.method ?? current.method).toUpperCase();
  const ts = nowIso();
  run(
    `UPDATE requests SET
       name = ?, description = ?, method = ?, url = ?, headers = ?, query = ?, body = ?, auth = ?, settings = ?,
       prerequest_script = ?, test_script = ?, collection_id = ?, folder_id = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND workspace_id = ?`,
    input.name.trim(), input.description ?? current.description ?? "", method, input.url,
    JSON.stringify(input.header ?? current.header ?? []),
    JSON.stringify(input.query ?? current.query ?? []),
    input.body ? JSON.stringify(input.body) : null,
    input.auth !== undefined ? (input.auth ? JSON.stringify(input.auth) : null) : (current.auth ? JSON.stringify(current.auth) : null),
    input.settings ? JSON.stringify(input.settings) : (current.settings ? JSON.stringify(current.settings) : null),
    input.events?.prerequest ?? current.events?.prerequest ?? null,
    input.events?.test ?? current.events?.test ?? null,
    input.collectionId ?? current.collectionId ?? null,
    input.folderId !== undefined ? input.folderId : (current.folderId ?? null),
    ts, id, workspaceId,
  );
  audit(userId, "request.update", "request", workspaceId, id, { name: input.name, method });
  return getRequest(userId, workspaceId, id);
}

export function deleteRequest(userId: string, workspaceId: string, id: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  withinTransaction(() => {
    run("DELETE FROM examples WHERE request_id = ?", id);
    run("DELETE FROM requests WHERE id = ? AND workspace_id = ?", id, workspaceId);
    audit(userId, "request.delete", "request", workspaceId, id, {});
  });
}

export function duplicateRequest(userId: string, workspaceId: string, id: string): ApiRequest {
  const src = getRequest(userId, workspaceId, id);
  const { createdAt: _c, updatedAt: _u, version: _v, id: _id, folderId: _f, ...rest } = src;
  void _c; void _u; void _v; void _id; void _f;
  return createRequest(userId, workspaceId, {
    ...rest,
    name: `${src.name} (copy)`,
    header: src.header,
    query: src.query,
    body: src.body,
    auth: src.auth,
    settings: src.settings,
    events: src.events,
    collectionId: src.collectionId,
    folderId: src.folderId,
  });
}