import { queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import {
  ApiError,
  newId,
  nowIso,
  type AuthConfig,
  type Collection,
  type CollectionFolder,
  type CollectionScripts,
  type HeaderEntry,
  type VariableDefinition,
} from "@apiplatform/shared";
import { assertWorkspaceAccess } from "../workspaces/service.js";
import { audit } from "../audit/service.js";

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  auth: string | null;
  prerequest_script: string | null;
  test_script: string | null;
  default_headers: string | null;
  variables: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

interface FolderRow {
  id: string;
  collection_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  auth: string | null;
  prerequest_script: string | null;
  test_script: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export function toCollection(row: CollectionRow): Collection {
  const events: CollectionScripts = {
    prerequest: row.prerequest_script ?? undefined,
    test: row.test_script ?? undefined,
  };
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    workspaceId: row.workspace_id,
    auth: row.auth ? (JSON.parse(row.auth) as AuthConfig) : undefined,
    events:
      events.prerequest || events.test ? events : undefined,
    variables: row.variables ? (JSON.parse(row.variables) as VariableDefinition[]) : [],
    defaultHeaders: row.default_headers ? (JSON.parse(row.default_headers) as HeaderEntry[]) : [],
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function toFolder(row: FolderRow): CollectionFolder {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    auth: row.auth ? (JSON.parse(row.auth) as AuthConfig) : undefined,
    events: (row.prerequest_script || row.test_script)
      ? { prerequest: row.prerequest_script ?? undefined, test: row.test_script ?? undefined }
      : undefined,
    order: row.sort_order,
  } as CollectionFolder & { collectionId?: string };
}

export function getCollection(userId: string, workspaceId: string, id: string): Collection {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const row = queryOne<CollectionRow>("SELECT * FROM collections WHERE id = ? AND workspace_id = ?", id, workspaceId);
  if (!row) throw ApiError.notFound("Collection not found");
  return toCollection(row);
}

export function listCollections(userId: string, workspaceId: string): Collection[] {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const rows = queryAll<CollectionRow>(
    "SELECT * FROM collections WHERE workspace_id = ? ORDER BY sort_order ASC, name ASC",
    workspaceId,
  );
  return rows.map(toCollection);
}

export function listFolders(workspaceId: string, collectionId: string): CollectionFolder[] {
  const rows = queryAll<FolderRow>(
    "SELECT * FROM folders WHERE collection_id = ? ORDER BY sort_order ASC, name ASC",
    collectionId,
  );
  return rows.map(toFolder);
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  auth?: AuthConfig | null;
  events?: CollectionScripts;
  variables?: VariableDefinition[];
  defaultHeaders?: HeaderEntry[];
}

export function createCollection(userId: string, workspaceId: string, input: CreateCollectionInput): Collection {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  if (!input.name?.trim()) throw ApiError.badRequest("Collection name is required");
  const id = newId("col");
  const ts = nowIso();
  const maxRow = queryOne<{ m: number | null }>(
    "SELECT MAX(sort_order) as m FROM collections WHERE workspace_id = ?",
    workspaceId,
  );
  const order = (maxRow?.m ?? 0) + 1;
  withinTransaction(() => {
    run(
      `INSERT INTO collections (id, name, description, workspace_id, auth, prerequest_script, test_script, default_headers, variables, sort_order, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      id, input.name.trim(), input.description ?? "", workspaceId,
      input.auth ? JSON.stringify(input.auth) : null,
      input.events?.prerequest ?? null,
      input.events?.test ?? null,
      input.defaultHeaders ? JSON.stringify(input.defaultHeaders) : null,
      input.variables ? JSON.stringify(input.variables) : null,
      order, ts, ts,
    );
    audit(userId, "collection.create", "collection", workspaceId, id, { name: input.name });
  });
  return getCollection(userId, workspaceId, id);
}

export function updateCollection(
  userId: string,
  workspaceId: string,
  id: string,
  input: Partial<CreateCollectionInput>,
): Collection {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const ts = nowIso();
  const existing = getCollection(userId, workspaceId, id);
  run(
    `UPDATE collections SET name = ?, description = ?, auth = ?, prerequest_script = ?, test_script = ?, default_headers = ?, variables = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND workspace_id = ?`,
    input.name?.trim() ?? existing.name,
    input.description ?? existing.description ?? "",
    input.auth !== undefined ? (input.auth ? JSON.stringify(input.auth) : null) : (existing.auth ? JSON.stringify(existing.auth) : null),
    input.events?.prerequest ?? existing.events?.prerequest ?? null,
    input.events?.test ?? existing.events?.test ?? null,
    input.defaultHeaders !== undefined ? JSON.stringify(input.defaultHeaders) : ((existing.defaultHeaders ?? []).length ? JSON.stringify(existing.defaultHeaders) : null),
    input.variables !== undefined ? JSON.stringify(input.variables) : ((existing.variables ?? []).length ? JSON.stringify(existing.variables) : null),
    ts,
    id,
    workspaceId,
  );
  audit(userId, "collection.update", "collection", workspaceId, id, {});
  return getCollection(userId, workspaceId, id);
}

export function deleteCollection(userId: string, workspaceId: string, id: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  withinTransaction(() => {
    run("DELETE FROM folders WHERE collection_id = ?", id);
    run("DELETE FROM requests WHERE collection_id = ?", id);
    run("DELETE FROM collections WHERE id = ? AND workspace_id = ?", id, workspaceId);
    audit(userId, "collection.delete", "collection", workspaceId, id, {});
  });
}

export function createFolder(
  userId: string,
  workspaceId: string,
  collectionId: string,
  input: { name: string; description?: string; parentFolderId?: string | null },
): CollectionFolder {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  const collection = getCollection(userId, workspaceId, collectionId);
  if (!input.name?.trim()) throw ApiError.badRequest("Folder name is required");
  const id = newId("fld");
  const ts = nowIso();
  run(
    `INSERT INTO folders (id, collection_id, parent_folder_id, name, description, sort_order, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`,
    id, collectionId, input.parentFolderId ?? null, input.name.trim(), input.description ?? "", ts, ts,
  );
  audit(userId, "collection.folder_create", "collection", workspaceId, collectionId, { folder: input.name });
  return toFolder(queryOne<FolderRow>("SELECT * FROM folders WHERE id = ?", id)!);
}

export function deleteFolder(userId: string, workspaceId: string, collectionId: string, folderId: string): void {
  assertWorkspaceAccess(userId, workspaceId, "editor");
  withinTransaction(() => {
    run("DELETE FROM requests WHERE folder_id = ?", folderId);
    run("DELETE FROM folders WHERE id = ? AND collection_id = ?", folderId, collectionId);
  });
}