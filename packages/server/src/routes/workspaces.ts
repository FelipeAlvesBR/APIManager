import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import {
  addMember,
  changeMemberRole,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceForMember,
  listMembers,
  listWorkspacesForUser,
  removeMember,
  updateWorkspace,
} from "../workspaces/service.js";
import { listAudit } from "../audit/service.js";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(["personal", "team", "private", "public", "partner"]).optional(),
});

const memberSchema = z.object({
  email: z.string().min(3),
  role: z.enum(["admin", "editor", "commenter", "viewer"]),
});

const roleSchema = z.object({
  role: z.enum(["admin", "editor", "commenter", "viewer"]),
});

workspacesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const workspaces = listWorkspacesForUser(req.user!.id);
    res.json({ workspaces });
  }),
);

workspacesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const workspace = createWorkspace(req.user!.id, input);
    res.status(201).json({ workspace });
  }),
);

workspacesRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const ws = getWorkspaceForMember(req.user!.id, req.params.workspaceId!);
    if (!ws) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workspace not found" } });
    res.json({ workspace: ws });
  }),
);

workspacesRouter.patch(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = createSchema.partial().parse(req.body);
    const workspace = updateWorkspace(req.user!.id, req.params.workspaceId!, input);
    res.json({ workspace });
  }),
);

workspacesRouter.delete(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    await deleteWorkspace(req.user!.id, req.params.workspaceId!);
    res.json({ ok: true });
  }),
);

workspacesRouter.get(
  "/:workspaceId/members",
  asyncHandler(async (req, res) => {
    const members = listMembers(req.user!.id, req.params.workspaceId!);
    res.json({ members });
  }),
);

workspacesRouter.post(
  "/:workspaceId/members",
  asyncHandler(async (req, res) => {
    const input = memberSchema.parse(req.body);
    addMember(req.user!.id, req.params.workspaceId!, input.email, input.role);
    res.status(201).json({ ok: true });
  }),
);

workspacesRouter.patch(
  "/:workspaceId/members/:userId",
  asyncHandler(async (req, res) => {
    const input = roleSchema.parse(req.body);
    changeMemberRole(req.user!.id, req.params.workspaceId!, req.params.userId!, input.role);
    res.json({ ok: true });
  }),
);

workspacesRouter.delete(
  "/:workspaceId/members/:userId",
  asyncHandler(async (req, res) => {
    removeMember(req.user!.id, req.params.workspaceId!, req.params.userId!);
    res.json({ ok: true });
  }),
);

workspacesRouter.get(
  "/:workspaceId/audit",
  asyncHandler(async (req, res) => {
    const events = listAudit(req.params.workspaceId!);
    res.json({ events });
  }),
);