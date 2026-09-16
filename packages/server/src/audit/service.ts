import { db, run } from "../db/connection.js";
import { nowIso, newId } from "@apiplatform/shared";

export function audit(
  actorId: string,
  action: string,
  resourceType: string,
  workspaceId: string | undefined,
  resourceId: string | undefined,
  details: Record<string, unknown>,
): void {
  const safeDetails = JSON.stringify(details ?? {});
  run(
    `INSERT INTO audit_events (id, workspace_id, actor_id, action, resource_type, resource_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("aud"),
    workspaceId ?? null,
    actorId,
    action,
    resourceType,
    resourceId ?? null,
    safeDetails,
    nowIso(),
  );
}

export function listAudit(workspaceId: string, limit = 100) {
  return db
    .prepare(
      `SELECT a.id, a.action, a.resource_type as resourceType, a.resource_id as resourceId,
              a.actor_id as actorId, a.details, a.created_at as createdAt,
              u.email as actorEmail, u.name as actorName
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.workspace_id = ?
        ORDER BY a.created_at DESC LIMIT ?`,
    )
    .all(workspaceId, limit);
}