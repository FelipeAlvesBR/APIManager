import {
  newId,
  nowIso,
  type ApiRequest,
  type RunSummary,
  type ScriptLog,
  type TestResult,
} from "@apiplatform/shared";
import { db, queryAll, queryOne, run } from "../db/connection.js";
import {
  assertWorkspaceAccess,
} from "../workspaces/service.js";
import {
  loadExecutionDefinition,
} from "./service.js";
import { executeRequest, type ExecutionResult } from "./executor.js";
import { audit } from "../audit/service.js";

export interface RunOptions {
  workspaceId: string;
  collectionId: string;
  environmentId?: string;
  iterations?: number;
  delayMs?: number;
  data?: Record<string, string>[];
  stopOnFailure?: boolean;
  folderId?: string;
  requestIds?: string[];
  signal?: AbortSignal;
}

export interface RunRequestResult {
  requestId: string;
  name: string;
  method: string;
  url: string;
  status: number | null;
  duration: number;
  passed: number;
  failed: number;
  total: number;
  error?: string;
  tests: TestResult[];
  logs: ScriptLog[];
}

export interface CollectionRunReport {
  id: string;
  summary: RunSummary;
  items: RunRequestResult[];
}

interface RequestIdRow {
  id: string;
}

export async function runCollection(userId: string, opts: RunOptions): Promise<CollectionRunReport> {
  assertWorkspaceAccess(userId, opts.workspaceId, "editor");

  // Materialize the full request objects for execution.
  let requestRows: RequestIdRow[];
  if (opts.requestIds && opts.requestIds.length) {
    requestRows = opts.requestIds.map((id) => ({ id }));
  } else if (opts.folderId) {
    requestRows = queryAll<RequestIdRow>("SELECT id FROM requests WHERE folder_id = ? ORDER BY sort_order ASC", opts.folderId);
  } else {
    requestRows = queryAll<RequestIdRow>("SELECT id FROM requests WHERE collection_id = ? ORDER BY sort_order ASC", opts.collectionId);
  }

  const iterations = Math.max(1, opts.iterations ?? 1);
  const delayMs = Math.max(0, opts.delayMs ?? 0);
  const runId = newId("run");
  const startedAt = nowIso();

  const items: RunRequestResult[] = [];
  let stop = false;

  const dataRows = opts.data ?? [];

  for (let i = 0; i < iterations; i++) {
    if (stop) break;
    const record = dataRows[i];
    const dataVars: Record<string, string> | undefined = record
      ? Object.fromEntries(Object.entries(record).map(([k, v]) => [k, String(v)]))
      : undefined;

    for (const row of requestRows) {
      if (stop) break;
      if (opts.signal?.aborted) throw Object.assign(new Error("Collection run aborted"), { status: 499 });

      const request = loadRequest(userId, opts.workspaceId, row.id);
      if (!request) continue;

      const def = loadExecutionDefinition({
        request,
        userId,
        workspaceId: opts.workspaceId,
        environmentId: opts.environmentId,
        data: dataVars,
      });

      let result: ExecutionResult;
      try {
        result = await executeRequest(def);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        items.push({
          requestId: request.id,
          name: request.name,
          method: request.method,
          url: request.url,
          status: null,
          duration: 0,
          passed: 0,
          failed: 1,
          total: 0,
          error: message,
          tests: [],
          logs: [],
        });
        if (opts.stopOnFailure) stop = true;
        continue;
      }

      const snapshot = result.response;
      const tests = snapshot.tests ?? [];
      const passed = tests.filter((t) => t.passed).length;
      const failed = tests.filter((t) => !t.passed).length;
      const item: RunRequestResult = {
        requestId: request.id,
        name: request.name,
        method: request.method,
        url: result.finalRequest.url,
        status: snapshot.status,
        duration: snapshot.durationMs,
        passed,
        failed,
        total: tests.length,
        error: snapshot.error?.message,
        tests,
        logs: snapshot.logs,
      };
      items.push(item);

      persistRunItem(runId, item, row.id, i);

      if (opts.stopOnFailure && (failed > 0 || snapshot.error)) {
        stop = true;
      }
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const summary = summarize(items, startedAt);
  const finishedAt = nowIso();
  run(
    "INSERT INTO runs (id, workspace_id, collection_id, summary, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)",
    runId,
    opts.workspaceId,
    opts.collectionId,
    JSON.stringify(summary),
    startedAt,
    finishedAt,
  );
  audit(userId, "collection.run", "collection", opts.workspaceId, opts.collectionId, { ...summary });

  return { id: runId, summary, items };
}

function loadRequest(userId: string, workspaceId: string, id: string): ApiRequest | undefined {
  const row = queryOne<{
    id: string; name: string; method: string; url: string; folder_id: string | null; collection_id: string | null; auth: string | null;
  }>(
    "SELECT id, name, method, url, folder_id, collection_id, auth FROM requests WHERE id = ? AND workspace_id = ?",
    id,
    workspaceId,
  );
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    method: row.method,
    url: row.url,
    folderId: row.folder_id ?? undefined,
    collectionId: row.collection_id ?? undefined,
    auth: row.auth ? JSON.parse(row.auth) : undefined,
  } as ApiRequest;
}

function persistRunItem(runId: string, item: RunRequestResult, requestId: string, iteration: number): void {
  run(
    `INSERT INTO run_items (id, run_id, request_id, name, method, url, status, duration, passed, assertion_count, skipped, error, tests, logs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    newId("ri"),
    runId,
    requestId,
    item.name,
    item.method,
    item.url,
    item.status,
    item.duration,
    item.passed,
    item.total,
    item.error ?? null,
    JSON.stringify(item.tests),
    JSON.stringify(item.logs),
  );
}

function summarize(items: RunRequestResult[], startedAt: string): RunSummary {
  const total = items.length;
  const passed = items.filter((i) => i.total > 0 && i.failed === 0 && !i.error).length;
  const failed = items.filter((i) => i.failed > 0 || i.error).length;
  return {
    total,
    passed,
    failed,
    skipped: 0,
    duration: items.reduce((sum, i) => sum + i.duration, 0),
    startedAt,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function listRuns(userId: string, workspaceId: string, limit = 50) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll(
    `SELECT id, collection_id as collectionId, summary, started_at as startedAt, finished_at as finishedAt
       FROM runs WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?`,
    workspaceId,
    limit,
  ).map((r) => ({ ...(r as object), summary: JSON.parse((r as { summary: string }).summary) }));
}

export function getRun(userId: string, workspaceId: string, runId: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const runRow = queryOne<{ id: string; collection_id: string | null; summary: string; started_at: string; finished_at: string | null }>(
    "SELECT * FROM runs WHERE id = ? AND workspace_id = ?",
    runId,
    workspaceId,
  );
  if (!runRow) return undefined;
  const items = queryAll(
    "SELECT * FROM run_items WHERE run_id = ? ORDER BY rowid ASC",
    runId,
  ).map((row) => ({
    ...(row as object),
    tests: JSON.parse((row as { tests: string }).tests),
    logs: JSON.parse((row as { logs: string }).logs),
  }));
  return {
    id: runRow.id,
    collectionId: runRow.collection_id,
    summary: JSON.parse(runRow.summary),
    startedAt: runRow.started_at,
    finishedAt: runRow.finished_at,
    items,
  };
}

export { db };