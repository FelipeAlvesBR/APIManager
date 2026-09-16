import type { WorkspaceRole } from "@apiplatform/shared";

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 50,
  admin: 40,
  editor: 30,
  commenter: 20,
  viewer: 10,
};

export type ResourcePermission = "read" | "write";

/** Minimum role required for each permission class. */
const REQUIRED: Record<ResourcePermission, WorkspaceRole> = {
  read: "viewer",
  write: "editor",
};

export function hasRole(actual: WorkspaceRole | undefined, required: WorkspaceRole): boolean {
  if (!actual) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function can(actual: WorkspaceRole | undefined, permission: ResourcePermission): boolean {
  return hasRole(actual, REQUIRED[permission]);
}

export function adminOrAbove(actual: WorkspaceRole | undefined): boolean {
  return hasRole(actual, "admin");
}