import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import { newId, nowIso, ApiError } from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";

interface SpecRow {
  id: string;
  name: string;
  workspace_id: string;
  format: string;
  content: string;
  created_at: string;
  updated_at: string;
  version: number;
}

function toSpec(row: SpecRow) {
  return {
    id: row.id,
    name: row.name,
    workspaceId: row.workspace_id,
    format: row.format,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function listSpecs(userId: string, workspaceId: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<SpecRow>("SELECT * FROM specs WHERE workspace_id = ? ORDER BY updated_at DESC", workspaceId).map((r) => ({ ...toSpec(r), content: undefined }));
}

export function getSpec(userId: string, workspaceId: string, id: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<SpecRow>("SELECT * FROM specs WHERE id = ? AND workspace_id = ?", id, workspaceId);
  if (!row) throw ApiError.notFound("Specification not found");
  return toSpec(row);
}

export function createSpec(userId: string, workspaceId: string, input: { name: string; format: string; content: string }) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const id = newId("spec");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      "INSERT INTO specs (id, name, workspace_id, format, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
      id, input.name.trim(), workspaceId, input.format, input.content, ts, ts,
    );
    audit(userId, "spec.create", "spec", workspaceId, id, { name: input.name, format: input.format });
  });
  return getSpec(userId, workspaceId, id);
}

export function updateSpec(userId: string, workspaceId: string, id: string, input: { name?: string; content?: string }) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const current = getSpec(userId, workspaceId, id);
  run(
    "UPDATE specs SET name = ?, content = ?, updated_at = ?, version = version + 1 WHERE id = ? AND workspace_id = ?",
    input.name?.trim() ?? current.name,
    input.content ?? current.content,
    nowIso(),
    id,
    workspaceId,
  );
  audit(userId, "spec.update", "spec", workspaceId, id, {});
  return getSpec(userId, workspaceId, id);
}

export function deleteSpec(userId: string, workspaceId: string, id: string) {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run("DELETE FROM specs WHERE id = ? AND workspace_id = ?", id, workspaceId);
  audit(userId, "spec.delete", "spec", workspaceId, id, {});
}

export interface SpecValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  path: string;
}

export function validateOpenApi(document: unknown): { valid: boolean; issues: SpecValidationIssue[]; summary: { paths: number; operations: number; schemas: number } } {
  const issues: SpecValidationIssue[] = [];
  if (!document || typeof document !== "object") {
    return { valid: false, issues: [{ severity: "error", message: "Document is empty or not an object", path: "$" }], summary: { paths: 0, operations: 0, schemas: 0 } };
  }
  const doc = document as Record<string, unknown>;
  if (!doc.openapi && !doc.swagger) {
    issues.push({ severity: "error", message: "Missing openapi/swagger version field", path: "$" });
  }
  if (!doc.info || typeof doc.info !== "object") {
    issues.push({ severity: "error", message: "Missing info object", path: "$.info" });
  }
  const paths = (doc.paths ?? {}) as Record<string, unknown>;
  const pathCount = Object.keys(paths).length;
  let operations = 0;
  const methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
  for (const [p, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") {
      issues.push({ severity: "error", message: "Path item must be an object", path: `$.paths.${p}` });
      continue;
    }
    let found = false;
    for (const m of methods) {
      if ((item as Record<string, unknown>)[m] !== undefined) {
        found = true;
        operations += 1;
        const op = (item as Record<string, unknown>)[m] as Record<string, unknown>;
        if (op.responses === undefined || Object.keys(op.responses as object).length === 0) {
          issues.push({ severity: "warning", message: `Operation ${m.toUpperCase()} has no responses`, path: `$.paths.${p}.${m}.responses` });
        }
      }
    }
    if (!found) {
      issues.push({ severity: "warning", message: "Path has no recognized operations", path: `$.paths.${p}` });
    }
  }
  const schemas = Object.keys(((doc.components as Record<string, unknown> | undefined)?.schemas as object) ?? {}).length;
  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    summary: { paths: pathCount, operations, schemas },
  };
}