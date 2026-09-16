import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import { newId, nowIso } from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";

interface MonitorRow {
  id: string;
  name: string;
  workspace_id: string;
  collection_id: string;
  environment_id: string | null;
  schedule: string;
  timeout_ms: number;
  failure_threshold: number;
  enabled: number;
  last_run_at: string | null;
  last_run_passed: number | null;
  created_at: string;
  updated_at: string;
}

function toMonitor(row: MonitorRow) {
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    environmentId: row.environment_id ?? undefined,
    schedule: row.schedule,
    timeoutMs: row.timeout_ms,
    failureThreshold: row.failure_threshold,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at ?? undefined,
    lastRunPassed: row.last_run_passed === null ? undefined : row.last_run_passed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMonitors(userId: string, workspaceId: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<MonitorRow>("SELECT * FROM monitors WHERE workspace_id = ? ORDER BY created_at DESC", workspaceId).map(toMonitor);
}

export function getMonitor(userId: string, workspaceId: string, id: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<MonitorRow>("SELECT * FROM monitors WHERE id = ? AND workspace_id = ?", id, workspaceId);
  return row ? toMonitor(row) : undefined;
}

export interface CreateMonitorInput {
  name: string;
  collectionId: string;
  environmentId?: string;
  schedule: string;
  timeoutMs?: number;
  failureThreshold?: number;
}

export function createMonitor(userId: string, workspaceId: string, input: CreateMonitorInput) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const id = newId("mon");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      "INSERT INTO monitors (id, name, workspace_id, collection_id, environment_id, schedule, timeout_ms, failure_threshold, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      id, input.name.trim(), workspaceId, input.collectionId, input.environmentId ?? null,
      input.schedule, input.timeoutMs ?? 30000, input.failureThreshold ?? 0, ts, ts,
    );
    audit(userId, "monitor.create", "monitor", workspaceId, id, { name: input.name });
  });
  return getMonitor(userId, workspaceId, id)!;
}

export function updateMonitor(userId: string, workspaceId: string, id: string, input: Partial<CreateMonitorInput> & { enabled?: boolean }) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const current = getMonitor(userId, workspaceId, id);
  if (!current) throw new Error("Monitor not found");
  run(
    "UPDATE monitors SET name = ?, schedule = ?, environment_id = ?, timeout_ms = ?, failure_threshold = ?, enabled = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    input.name ?? current.name,
    input.schedule ?? current.schedule,
    input.environmentId ?? current.environmentId ?? null,
    input.timeoutMs ?? current.timeoutMs,
    input.failureThreshold ?? current.failureThreshold,
    input.enabled === undefined ? (current.enabled ? 1 : 0) : input.enabled ? 1 : 0,
    nowIso(),
    id,
    workspaceId,
  );
  audit(userId, "monitor.update", "monitor", workspaceId, id, {});
  return getMonitor(userId, workspaceId, id)!;
}

export function deleteMonitor(userId: string, workspaceId: string, id: string) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run("DELETE FROM monitor_runs WHERE monitor_id = ?", id);
  run("DELETE FROM monitors WHERE id = ? AND workspace_id = ?", id, workspaceId);
  audit(userId, "monitor.delete", "monitor", workspaceId, id, {});
}

export function recordMonitorRun(monitorId: string, passed: boolean, status: number | null, latency: number, details: unknown) {
  run(
    "INSERT INTO monitor_runs (id, monitor_id, passed, status, latency, details, run_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("mrun"), monitorId, passed ? 1 : 0, status, latency, JSON.stringify(details ?? {}), nowIso(),
  );
  run("UPDATE monitors SET last_run_at = ?, last_run_passed = ? WHERE id = ?", nowIso(), passed ? 1 : 0, monitorId);
}

export function listMonitorRunsForMonitor(monitorId: string, limit = 50) {
  return queryAll(
    "SELECT * FROM monitor_runs WHERE monitor_id = ? ORDER BY run_at DESC LIMIT ?",
    monitorId,
    limit,
  );
}

/** Determine whether a schedule string is due to run now (cron-like or interval). */
export function isScheduleDue(schedule: string, lastRunAt: string | null | undefined): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  const now = Date.now();
  const ms = parseScheduleMs(schedule);
  if (!ms) return false;
  return now - last >= ms;
}

export function parseScheduleMs(schedule: string): number {
  const minutes = { "1min": 60_000, "5min": 300_000, "15min": 900_000, hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
  const normalized = schedule.toLowerCase().replace(/\s+/g, "");
  if (minutes[normalized as keyof typeof minutes]) return minutes[normalized as keyof typeof minutes];
  // "every-5-minutes" style
  const every = normalized.match(/^every-(\d+)-minute?s?$/);
  if (every) return Number(every[1]) * 60_000;
  // "cron:*/5 * * * *" — fallback to 5 minutes (cron handled by a proper scheduler elsewhere).
  if (normalized.startsWith("cron:")) return 300_000;
  return 0;
}

/** List all enabled monitors due for a run (used by the scheduler). */
export function listDueMonitors(): MonitorRow[] {
  const rows = queryAll<MonitorRow>("SELECT * FROM monitors WHERE enabled = 1");
  return rows.filter((m) => isScheduleDue(m.schedule, m.last_run_at));
}