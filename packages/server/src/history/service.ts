import { queryAll, queryOne, run } from "../db/connection.js";
import { newId, nowIso, type HistoryEntry, type ResponseSnapshot } from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";

export interface RecordHistoryInput {
  workspaceId: string;
  collectionId?: string;
  environmentId?: string;
  method: string;
  url: string;
  status: number | null;
  duration: number;
  responseSummary: string;
}

export function recordHistory(input: RecordHistoryInput): HistoryEntry {
  const id = newId("hst");
  run(
    `INSERT INTO history (id, workspace_id, collection_id, environment_id, method, url, status, duration, sent_at, response_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.workspaceId,
    input.collectionId ?? null,
    input.environmentId ?? null,
    input.method,
    input.url,
    input.status,
    input.duration,
    nowIso(),
    input.responseSummary.slice(0, 4000),
  );
  return {
    id,
    workspaceId: input.workspaceId,
    collectionId: input.collectionId,
    environmentId: input.environmentId,
    method: input.method,
    url: input.url,
    status: input.status,
    duration: input.duration,
    sentAt: nowIso(),
    responseSummary: input.responseSummary,
  };
}

export interface HistoryFilters {
  method?: string;
  status?: string;
  host?: string;
  collectionId?: string;
  environmentId?: string;
  success?: string;
  from?: string;
  to?: string;
  search?: string;
  sort?: string;
}

export function listHistory(userId: string, workspaceId: string, filters: HistoryFilters = {}) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const clauses: string[] = ["workspace_id = ?"];
  const params: unknown[] = [workspaceId];

  if (filters.method) {
    clauses.push("method = ?");
    params.push(filters.method.toUpperCase());
  }
  if (filters.status) {
    clauses.push("status = ?");
    params.push(Number.parseInt(filters.status, 10));
  }
  if (filters.host) {
    clauses.push("url LIKE ?");
    params.push(`%${filters.host}%`);
  }
  if (filters.collectionId) {
    clauses.push("collection_id = ?");
    params.push(filters.collectionId);
  }
  if (filters.environmentId) {
    clauses.push("environment_id = ?");
    params.push(filters.environmentId);
  }
  if (filters.success === "true") {
    clauses.push("status >= 200 AND status < 400");
  } else if (filters.success === "false") {
    clauses.push("(status < 200 OR status >= 400)");
  }
  if (filters.search) {
    clauses.push("(url LIKE ? OR method LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.from) {
    clauses.push("sent_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("sent_at <= ?");
    params.push(filters.to);
  }

  const order =
    filters.sort === "duration"
      ? "duration DESC"
      : filters.sort === "oldest"
        ? "sent_at ASC"
        : "sent_at DESC";

  const where = clauses.join(" AND ");
  const rows = queryAll<HistoryEntry>(
    `SELECT * FROM history WHERE ${where} ORDER BY ${order} LIMIT 500`,
    ...params,
  );
  return rows;
}

export function buildResponseSummary(snapshot: ResponseSnapshot): string {
  const head = snapshot.body.slice(0, 500);
  return `${snapshot.statusText ? snapshot.status + " " : ""}${head}`;
}

export function deleteHistory(userId: string, workspaceId: string, ids: string[]): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  for (const id of ids) {
    run("DELETE FROM history WHERE id = ? AND workspace_id = ?", id, workspaceId);
  }
}

export function clearHistory(userId: string, workspaceId: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run("DELETE FROM history WHERE workspace_id = ?", workspaceId);
}

export function getHistoryById(userId: string, workspaceId: string, id: string): HistoryEntry | undefined {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryOne<HistoryEntry>("SELECT * FROM history WHERE id = ? AND workspace_id = ?", id, workspaceId);
}