import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import {
  ApiError,
  newId,
  nowIso,
} from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";
import { vault } from "./crypto.js";

interface SecretRow {
  id: string;
  workspace_id: string;
  key: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  created_at: string;
  updated_at: string;
}

export interface SecretSummary {
  id: string;
  key: string;
  updatedAt: string;
  hasValue: boolean;
}

function toSummary(row: SecretRow): SecretSummary {
  return { id: row.id, key: row.key, updatedAt: row.updated_at, hasValue: true };
}

export function listSecrets(userId: string, workspaceId: string): SecretSummary[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  return queryAll<SecretRow>(
    "SELECT * FROM secrets WHERE workspace_id = ? ORDER BY key ASC",
    workspaceId,
  ).map(toSummary);
}

export function setSecret(userId: string, workspaceId: string, key: string, value: string): SecretSummary {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const normalized = key.trim();
  if (!normalized) throw ApiError.badRequest("Secret key is required");
  const { ciphertext, iv, authTag } = vault.encrypt(value);
  const ts = nowIso();
  const existing = queryOne<{ id: string }>("SELECT id FROM secrets WHERE workspace_id = ? AND key = ?", workspaceId, normalized);
  if (existing) {
    run(
      "UPDATE secrets SET ciphertext = ?, iv = ?, auth_tag = ?, updated_at = ? WHERE id = ?",
      ciphertext, iv, authTag, ts, existing.id,
    );
  } else {
    run(
      "INSERT INTO secrets (id, workspace_id, key, ciphertext, iv, auth_tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      newId("sec"), workspaceId, normalized, ciphertext, iv, authTag, ts, ts,
    );
  }
  audit(userId, "secret.set", "secret", workspaceId, undefined, { key: normalized });
  const row = queryOne<SecretRow>("SELECT * FROM secrets WHERE workspace_id = ? AND key = ?", workspaceId, normalized)!;
  return toSummary(row);
}

export function getSecretValue(userId: string, workspaceId: string, key: string): string {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const row = queryOne<SecretRow>("SELECT * FROM secrets WHERE workspace_id = ? AND key = ?", workspaceId, key.trim());
  if (!row) throw ApiError.notFound("Secret not found");
  const value = vault.decrypt(row.ciphertext, row.iv, row.auth_tag);
  audit(userId, "secret.revealed", "secret", workspaceId, row.id, { key: row.key });
  return value;
}

export function deleteSecret(userId: string, workspaceId: string, key: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  run("DELETE FROM secrets WHERE workspace_id = ? AND key = ?", workspaceId, key.trim());
  audit(userId, "secret.delete", "secret", workspaceId, undefined, { key: key.trim() });
}

/** Retrieve a secret for internal script/runner use (no user-audit, no auth check). */
export function getSecretInternal(workspaceId: string, key: string): string | undefined {
  const row = queryOne<SecretRow>("SELECT * FROM secrets WHERE workspace_id = ? AND key = ?", workspaceId, key);
  if (!row) return undefined;
  return vault.decrypt(row.ciphertext, row.iv, row.auth_tag);
}

export function useSecret(workspaceId: string, key: string): string {
  const value = getSecretInternal(workspaceId, key);
  if (value === undefined) throw ApiError.notFound(`Secret "${key}" is not defined in this workspace`);
  return value;
}

export function listSecretsInternal(workspaceId: string): Map<string, string> {
  const rows = queryAll<SecretRow>("SELECT * FROM secrets WHERE workspace_id = ?", workspaceId);
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, vault.decrypt(row.ciphertext, row.iv, row.auth_tag));
  }
  return map;
}

export function useTransaction(): typeof withinTransaction {
  return withinTransaction;
}