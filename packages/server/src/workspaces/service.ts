import { db, queryAll, queryOne, run, withinTransaction } from "../db/connection.js";
import { ApiError, newId, nowIso, type Visibility, type WorkspaceRole } from "@apiplatform/shared";
import { hasRole } from "./access.js";
import { audit } from "../audit/service.js";

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: Visibility;
  owner_id: string;
  organization_id: string | null;
  settings: string | null;
  linked_git_repo: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
}

function toPublic(row: WorkspaceRow, role?: string) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    visibility: row.visibility,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    settings: row.settings ? JSON.parse(row.settings) : {},
    linkedGitRepo: row.linked_git_repo ? JSON.parse(row.linked_git_repo) : null,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export function getWorkspace(id: string): WorkspaceRow | undefined {
  return queryOne<WorkspaceRow>("SELECT * FROM workspaces WHERE id = ?", id);
}

export function getRole(userId: string, workspaceId: string): WorkspaceRole | undefined {
  const row = queryOne<WorkspaceMemberRow>(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
    workspaceId,
    userId,
  );
  return row?.role;
}

export function listWorkspacesForUser(userId: string) {
  const rows = queryAll<WorkspaceRow & { joined_at: string; role: WorkspaceRole }>(
    `SELECT w.*, m.role as role
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = ?
      ORDER BY w.updated_at DESC`,
    userId,
  );
  return rows.map((r) => toPublic(r, r.role));
}

export function getWorkspaceForMember(userId: string, workspaceId: string) {
  const row = queryOne<WorkspaceRow & { role: WorkspaceRole }>(
    `SELECT w.*, m.role as role
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
      WHERE w.id = ? AND m.user_id = ?`,
    workspaceId,
    userId,
  );
  if (!row) return undefined;
  return toPublic(row, row.role);
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  visibility?: Visibility;
}

export function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const id = newId("ws");
  const ts = nowIso();
  const name = input.name.trim();
  if (!name) throw ApiError.badRequest("Workspace name is required");
  withinTransaction(() => {
    run(
      `INSERT INTO workspaces (id, name, slug, description, visibility, owner_id, organization_id, settings, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, NULL, '{}', ?, ?, 1)`,
      id,
      name,
      slugify(name, id),
      input.description ?? "",
      input.visibility ?? "personal",
      userId,
      ts,
      ts,
    );
    run(
      "INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
      id,
      userId,
      ts,
    );
    audit(userId, "workspace.create", "workspace", id, id, { name });
  });
  return toPublic(getWorkspace(id)!, "owner");
}

export function updateWorkspace(userId: string, workspaceId: string, input: Partial<CreateWorkspaceInput> & { settings?: Record<string, unknown> }) {
  assertWorkspaceAccess(userId, workspaceId, "admin");
  const ts = nowIso();
  if (input.name) {
    run("UPDATE workspaces SET name = ?, updated_at = ?, version = version + 1 WHERE id = ?", input.name.trim(), ts, workspaceId);
  }
  if (input.description !== undefined) {
    run("UPDATE workspaces SET description = ?, updated_at = ?, version = version + 1 WHERE id = ?", input.description, ts, workspaceId);
  }
  if (input.visibility) {
    run("UPDATE workspaces SET visibility = ?, updated_at = ?, version = version + 1 WHERE id = ?", input.visibility, ts, workspaceId);
  }
  if (input.settings) {
    run("UPDATE workspaces SET settings = ?, updated_at = ?, version = version + 1 WHERE id = ?", JSON.stringify(input.settings), ts, workspaceId);
  }
  audit(userId, "workspace.update", "workspace", workspaceId, workspaceId, {});
  return toPublic(getWorkspace(workspaceId)!, getRole(userId, workspaceId));
}

export function deleteWorkspace(userId: string, workspaceId: string): void {
  assertWorkspaceAccess(userId, workspaceId, "owner");
  withinTransaction(() => {
    // Cross-referencing children (no direct workspace_id column).
    run(
      "DELETE FROM run_items WHERE run_id IN (SELECT id FROM runs WHERE workspace_id = ?)",
      workspaceId,
    );
    run(
      "DELETE FROM examples WHERE request_id IN (SELECT id FROM requests WHERE workspace_id = ?)",
      workspaceId,
    );
    run(
      "DELETE FROM folders WHERE collection_id IN (SELECT id FROM collections WHERE workspace_id = ?)",
      workspaceId,
    );
    run(
      "DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE workspace_id = ?)",
      workspaceId,
    );
    // Direct children.
    for (const table of [
      "runs", "monitor_runs", "monitors", "mocks", "history", "secrets",
      "comments", "documents", "specs", "ai_conversations", "ai_providers",
      "requests", "collections", "environments", "globals", "workspace_members",
    ]) {
      run(`DELETE FROM ${table} WHERE workspace_id = ?`, workspaceId);
    }
    run("DELETE FROM workspaces WHERE id = ?", workspaceId);
    audit(userId, "workspace.delete", "workspace", workspaceId, undefined, {});
  });
}

export function listMembers(userId: string, workspaceId: string) {
  assertWorkspaceAccess(userId, workspaceId, "viewer");
  const rows = queryAll<{ user_id: string; role: WorkspaceRole; joined_at: string; email: string; name: string }>(
    `SELECT m.user_id, m.role, m.joined_at, u.email, u.name
       FROM workspace_members m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ?
      ORDER BY m.joined_at ASC`,
    workspaceId,
  );
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role,
    email: r.email,
    name: r.name,
    joinedAt: r.joined_at,
  }));
}

export function addMember(actorId: string, workspaceId: string, email: string, role: WorkspaceRole): void {
  assertWorkspaceAccess(actorId, workspaceId, "admin");
  const user = queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", email.trim().toLowerCase());
  if (!user) throw ApiError.notFound("No user found with that email. Invite them to register first.");
  if (role === "owner") throw ApiError.badRequest("There can only be one owner. Use admin instead.");
  run(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role`,
    workspaceId,
    user.id,
    role,
    nowIso(),
  );
  audit(actorId, "workspace.member_added", "workspace", workspaceId, user.id, { role });
}

export function changeMemberRole(actorId: string, workspaceId: string, targetUserId: string, role: WorkspaceRole): void {
  assertWorkspaceAccess(actorId, workspaceId, "admin");
  if (role === "owner") throw ApiError.badRequest("The owner cannot be reassigned.");
  const member = queryOne<{ role: WorkspaceRole }>(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
    workspaceId,
    targetUserId,
  );
  if (!member) throw ApiError.notFound("Member not found");
  if (member.role === "owner") throw ApiError.forbidden("Cannot change the owner's role");
  run("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?", role, workspaceId, targetUserId);
  audit(actorId, "workspace.member_role_changed", "workspace", workspaceId, targetUserId, { role });
}

export function removeMember(actorId: string, workspaceId: string, targetUserId: string): void {
  assertWorkspaceAccess(actorId, workspaceId, "admin");
  if (targetUserId === (getWorkspace(workspaceId)?.owner_id)) {
    throw ApiError.forbidden("The owner cannot be removed");
  }
  run("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?", workspaceId, targetUserId);
  audit(actorId, "workspace.member_removed", "workspace", workspaceId, targetUserId, {});
}

export function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
  required: "viewer" | "editor" | "admin" | "owner",
): WorkspaceRole {
  const ws = getWorkspace(workspaceId);
  if (!ws) throw ApiError.notFound("Workspace not found");
  const role = getRole(userId, workspaceId);
  if (ws.visibility === "public" && hasRole(role, "viewer") === false && required === "viewer") {
    return "viewer"; // public workspaces are readable by any authenticated user
  }
  if (!hasRole(role, required)) {
    throw required === "viewer"
      ? ApiError.forbidden("You do not have access to this workspace")
      : ApiError.forbidden(`This action requires the "${required}" role`);
  }
  return role!;
}

function slugify(name: string, id: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base || "workspace"}-${id.slice(-6)}`;
}