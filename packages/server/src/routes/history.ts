import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { clearHistory, deleteHistory, getHistoryById, listHistory } from "../history/service.js";
import { loadExecutionDefinition } from "../runner/service.js";
import { executeRequest } from "../runner/executor.js";
import { recordHistory, buildResponseSummary } from "../history/service.js";

export const historyRouter = Router();
historyRouter.use(requireAuth);

historyRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const filters = {
      method: req.query.method as string | undefined,
      status: req.query.status as string | undefined,
      host: req.query.host as string | undefined,
      collectionId: req.query.collectionId as string | undefined,
      environmentId: req.query.environmentId as string | undefined,
      success: req.query.success as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      search: req.query.search as string | undefined,
      sort: req.query.sort as string | undefined,
    };
    const entries = listHistory(req.user!.id, req.params.workspaceId!, filters);
    res.json({ entries });
  }),
);

historyRouter.delete(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const ids = z.array(z.string()).parse(req.body.ids);
    deleteHistory(req.user!.id, req.params.workspaceId!, ids);
    res.json({ ok: true });
  }),
);

historyRouter.post(
  "/:workspaceId/clear",
  asyncHandler(async (req, res) => {
    clearHistory(req.user!.id, req.params.workspaceId!);
    res.json({ ok: true });
  }),
);

historyRouter.get(
  "/:workspaceId/:historyId",
  asyncHandler(async (req, res) => {
    const entry = getHistoryById(req.user!.id, req.params.workspaceId!, req.params.historyId!);
    res.json({ entry });
  }),
);

historyRouter.post(
  "/:workspaceId/:historyId/replay",
  asyncHandler(async (req, res) => {
    const entry = getHistoryById(req.user!.id, req.params.workspaceId!, req.params.historyId!);
    if (!entry) return res.status(404).json({ error: { code: "NOT_FOUND", message: "History entry not found" } });

    const fakeRequest = {
      id: entry.id,
      name: `Replay ${entry.method}`,
      method: entry.method,
      url: entry.url,
      workspaceId: req.params.workspaceId!,
      collectionId: entry.collectionId,
    };
    const def = loadExecutionDefinition({
      request: fakeRequest as never,
      userId: req.user!.id,
      workspaceId: req.params.workspaceId!,
      environmentId: entry.environmentId,
    });
    const result = await executeRequest(def);
    recordHistory({
      workspaceId: req.params.workspaceId!,
      collectionId: entry.collectionId,
      environmentId: entry.environmentId,
      method: result.finalRequest.method,
      url: result.finalRequest.url,
      status: result.response.status,
      duration: result.response.durationMs,
      responseSummary: buildResponseSummary(result.response),
    });
    res.json({ response: result.response, request: result.finalRequest, tests: result.response.tests });
  }),
);