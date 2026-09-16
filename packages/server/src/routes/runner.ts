import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { ApiError } from "@apiplatform/shared";
import {
  createMock,
  deleteMock,
  getMock,
  listMocks,
  routesFromCollection,
} from "../mocks/service.js";
import {
  createMonitor,
  deleteMonitor,
  getMonitor,
  listMonitorRunsForMonitor,
  listMonitors,
  updateMonitor,
} from "../monitors/service.js";
import { runCollection, listRuns, getRun } from "../runner/collectionRunner.js";
import { recordMonitorRun } from "../monitors/service.js";

export const runnerRouter = Router();
runnerRouter.use(requireAuth);

// ---- Collection runs ----
const runSchema = z.object({
  collectionId: z.string(),
  environmentId: z.string().optional(),
  iterations: z.number().int().min(1).max(1000).optional(),
  delayMs: z.number().int().min(0).max(120000).optional(),
  data: z.array(z.record(z.unknown())).optional(),
  stopOnFailure: z.boolean().optional(),
  folderId: z.string().optional(),
});

runnerRouter.post(
  "/runs/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = runSchema.parse(req.body);
    const report = await runCollection(req.user!.id, {
      workspaceId: req.params.workspaceId!,
      collectionId: input.collectionId,
      environmentId: input.environmentId,
      iterations: input.iterations,
      delayMs: input.delayMs,
      data: input.data as Record<string, string>[],
      stopOnFailure: input.stopOnFailure,
      folderId: input.folderId,
    });
    res.json(report);
  }),
);

runnerRouter.get(
  "/runs/:workspaceId",
  asyncHandler(async (req, res) => {
    const runs = listRuns(req.user!.id, req.params.workspaceId!);
    res.json({ runs });
  }),
);

runnerRouter.get(
  "/runs/:workspaceId/:runId",
  asyncHandler(async (req, res) => {
    const run = getRun(req.user!.id, req.params.workspaceId!, req.params.runId!);
    if (!run) throw ApiError.notFound("Run not found");
    res.json({ run });
  }),
);

// ---- Mocks ----
const mockSchema = z.object({
  name: z.string().min(1),
  sourceCollectionId: z.string().optional(),
  routes: z.array(z.unknown()).optional(),
  latency: z.number().int().min(0).optional(),
  defaultHeaders: z.record(z.string()).optional(),
});

runnerRouter.get("/mocks/:workspaceId", asyncHandler(async (req, res) => {
  const mocks = listMocks(req.user!.id, req.params.workspaceId!);
  res.json({ mocks });
}));

runnerRouter.post("/mocks/:workspaceId", asyncHandler(async (req, res) => {
  const input = mockSchema.parse(req.body);
  let routes = input.routes;
  if (!routes && input.sourceCollectionId) {
    routes = routesFromCollection(req.user!.id, req.params.workspaceId!, input.sourceCollectionId);
  }
  const mock = createMock(req.user!.id, req.params.workspaceId!, { ...input, routes: routes as never });
  res.status(201).json({ mock });
}));

runnerRouter.get("/mocks/:workspaceId/:mockId", asyncHandler(async (req, res) => {
  const mock = getMock(req.user!.id, req.params.workspaceId!, req.params.mockId!);
  res.json({ mock });
}));

runnerRouter.delete("/mocks/:workspaceId/:mockId", asyncHandler(async (req, res) => {
  deleteMock(req.user!.id, req.params.workspaceId!, req.params.mockId!);
  res.json({ ok: true });
}));

// ---- Monitors ----
const monitorSchema = z.object({
  name: z.string().min(1),
  collectionId: z.string(),
  environmentId: z.string().optional(),
  schedule: z.string(),
  timeoutMs: z.number().int().optional(),
  failureThreshold: z.number().int().min(0).optional(),
});

runnerRouter.get("/monitors/:workspaceId", asyncHandler(async (req, res) => {
  const monitors = listMonitors(req.user!.id, req.params.workspaceId!);
  res.json({ monitors });
}));

runnerRouter.post("/monitors/:workspaceId", asyncHandler(async (req, res) => {
  const input = monitorSchema.parse(req.body);
  const monitor = createMonitor(req.user!.id, req.params.workspaceId!, input);
  res.status(201).json({ monitor });
}));

runnerRouter.get("/monitors/:workspaceId/:monitorId", asyncHandler(async (req, res) => {
  const monitor = getMonitor(req.user!.id, req.params.workspaceId!, req.params.monitorId!);
  if (!monitor) throw ApiError.notFound("Monitor not found");
  res.json({ monitor });
}));

runnerRouter.patch("/monitors/:workspaceId/:monitorId", asyncHandler(async (req, res) => {
  const input = monitorSchema.partial().extend({ enabled: z.boolean().optional() }).parse(req.body);
  const monitor = updateMonitor(req.user!.id, req.params.workspaceId!, req.params.monitorId!, input);
  res.json({ monitor });
}));

runnerRouter.delete("/monitors/:workspaceId/:monitorId", asyncHandler(async (req, res) => {
  deleteMonitor(req.user!.id, req.params.workspaceId!, req.params.monitorId!);
  res.json({ ok: true });
}));

runnerRouter.post("/monitors/:workspaceId/:monitorId/run", asyncHandler(async (req, res) => {
  const monitor = getMonitor(req.user!.id, req.params.workspaceId!, req.params.monitorId!);
  if (!monitor) throw ApiError.notFound("Monitor not found");
  const report = await runCollection(req.user!.id, {
    workspaceId: req.params.workspaceId!,
    collectionId: monitor.collectionId,
    environmentId: monitor.environmentId,
  });
  const passed = report.summary.failed === 0;
  recordMonitorRun(monitor.id, passed, report.items.at(-1)?.status ?? null, report.summary.duration, report.summary);
  res.json({ passed, summary: report.summary });
}));

runnerRouter.get("/monitors/:workspaceId/:monitorId/runs", asyncHandler(async (req, res) => {
  const runs = listMonitorRunsForMonitor(req.params.monitorId!);
  res.json({ runs });
}));