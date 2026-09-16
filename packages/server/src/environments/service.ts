import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import {
  ApiError,
  newId,
  nowIso,
  type Environment,
  type VariableDefinition,
} from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";

interface EnvironmentRow {
  id: string;
  name: string;
  workspace_id: string;
  variables: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export function toEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
    variables: row.variables ? (JSON.parse(row.variables) as VariableDefinition[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function getEnvironment(userId: string, workspaceId: string, id: string): Environment {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<EnvironmentRow>("SELECT * FROM environments WHERE id = ? AND workspace_id = ?", id, workspaceId);
  if (!row) throw ApiError.notFound("Environment not found");
  return toEnvironment(row);
}

export function listEnvironments(userId: string, workspaceId: string): Environment[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<EnvironmentRow>(
    "SELECT * FROM environments WHERE workspace_id = ? ORDER BY created_at ASC",
    workspaceId,
  ).map(toEnvironment);
}

export function createEnvironment(userId: string, workspaceId: string, input: { name: string; variables?: VariableDefinition[] }): Environment {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  if (!input.name?.trim()) throw ApiError.badRequest("Environment name is required");
  const id = newId("env");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      "INSERT INTO environments (id, name, workspace_id, variables, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, 1)",
      id, input.name.trim(), workspaceId, JSON.stringify(input.variables ?? []), ts, ts,
    );
    audit(userId, "environment.create", "environment", workspaceId, id, { name: input.name });
  });
  return getEnvironment(userId, workspaceId, id);
}

export function updateEnvironment(
  userId: string,
  workspaceId: string,
  id: string,
  input: { name?: string; variables?: VariableDefinition[] },
): Environment {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const current = getEnvironment(userId, workspaceId, id);
  run(
    "UPDATE environments SET name = ?, variables = ?, updated_at = ?, version = version + 1 WHERE id = ? AND workspace_id = ?",
    input.name?.trim() ?? current.name,
    JSON.stringify(input.variables ?? current.variables),
    nowIso(),
    id,
    workspaceId,
  );
  audit(userId, "environment.update", "environment", workspaceId, id, {});
  return getEnvironment(userId, workspaceId, id);
}

export function deleteEnvironment(userId: string, workspaceId: string, id: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  withinTransaction(() => {
    run("DELETE FROM environments WHERE id = ? AND workspace_id = ?", id, workspaceId);
    audit(userId, "environment.delete", "environment", workspaceId, id, {});
  });
}

export function duplicateEnvironment(userId: string, workspaceId: string, id: string): Environment {
  const src = getEnvironment(userId, workspaceId, id);
  return createEnvironment(userId, workspaceId, { name: `${src.name} (copy)`, variables: src.variables });
}

// ---- Global variables ----

export function getGlobalVariables(userId: string, workspaceId: string): VariableDefinition[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<{ variables: string | null }>("SELECT variables FROM globals WHERE workspace_id = ?", workspaceId);
  return row?.variables ? (JSON.parse(row.variables) as VariableDefinition[]) : [];
}

export function setGlobalVariables(userId: string, workspaceId: string, variables: VariableDefinition[]): VariableDefinition[] {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run(
    `INSERT INTO globals (workspace_id, variables, updated_at, version) VALUES (?, ?, ?, 1)
     ON CONFLICT(workspace_id) DO UPDATE SET variables = excluded.variables, updated_at = excluded.updated_at, version = version + 1`,
    workspaceId,
    JSON.stringify(variables),
    nowIso(),
  );
  audit(userId, "environment.globals_update", "environment", workspaceId, undefined, {});
  return variables;
}