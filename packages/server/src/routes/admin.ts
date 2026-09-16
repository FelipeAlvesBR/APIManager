import { Router } from "express";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { ApiError } from "@apiplatform/shared";
import { listAudit } from "../audit/service.js";
import { assertWorkspaceAccess } from "../workspaces/service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get(
  "/:workspaceId/audit",
  asyncHandler(async (req, res) => {
    assertWorkspaceAccess(req.user!.id, req.params.workspaceId!, "admin");
    const events = listAudit(req.params.workspaceId!, Number(req.query.limit) || 100);
    res.json({ events });
  }),
);

adminRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  }),
);