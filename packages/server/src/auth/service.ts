import { db, run, queryOne, withinTransaction } from "../db/connection.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signToken } from "./token.js";
import { ApiError, newId, nowIso } from "@apiplatform/shared";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  active: number;
  token_version: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest("A valid email address is required");
  }
  if (input.password.length < 8) {
    throw ApiError.badRequest("Password must be at least 8 characters");
  }
  const existing = queryOne<UserRow>("SELECT id FROM users WHERE email = ?", email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const id = newId("usr");
  const ts = nowIso();
  withinTransaction(() => {
    run(
      `INSERT INTO users (id, email, name, password_hash, active, token_version, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, 1, 0, ?, ?, 1)`,
      id,
      email,
      input.name.trim() || email.split("@")[0],
      passwordHash,
      ts,
      ts,
    );
    // Every new user gets a personal workspace.
    const wsId = newId("ws");
    run(
      `INSERT INTO workspaces (id, name, slug, description, visibility, owner_id, organization_id, settings, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, 'personal', ?, NULL, '{}', ?, ?, 1)`,
      wsId,
      "My Workspace",
      `personal-${id}`,
      "Your personal API workspace",
      id,
      ts,
      ts,
    );
    run(
      "INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
      wsId,
      id,
      ts,
    );
  });
  const user = queryOne<UserRow>("SELECT * FROM users WHERE id = ?", id)!;
  return { token: signToken(id, 0), user: toPublicUser(user) };
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const user = queryOne<UserRow>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
  if (!user || user.active !== 1) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  return { token: signToken(user.id, user.token_version), user: toPublicUser(user) };
}

export function getUserById(id: string): UserRow | undefined {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export function assertActiveUser(row: UserRow | undefined): UserRow {
  if (!row || row.active !== 1) {
    throw ApiError.unauthorized("Account is disabled or does not exist");
  }
  return row;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return queryOne<UserRow>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
}

export { db };