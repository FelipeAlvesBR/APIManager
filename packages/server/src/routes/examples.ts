import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { ApiError } from "@apiplatform/shared";
import { listExamples, saveExample, deleteExample } from "../examples/service.js";
import { getRequest } from "../requests/service.js";

export const examplesRouter = Router();
examplesRouter.use(requireAuth);

const exampleSchema = z.object({
  name: z.string().optional(),
  status: z.number().int(),
  statusText: z.string().default(""),
  headers: z.record(z.string()).default({}),
  body: z.string().default(""),
});

examplesRouter.get(
  "/:workspaceId/:requestId",
  asyncHandler(async (req, res) => {
    getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    const examples = listExamples(req.params.requestId!);
    res.json({ examples });
  }),
);

examplesRouter.post(
  "/:workspaceId/:requestId",
  asyncHandler(async (req, res) => {
    getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    const input = exampleSchema.parse(req.body);
    const example = saveExample({ ...input, requestId: req.params.requestId! });
    res.status(201).json({ example });
  }),
);

examplesRouter.delete(
  "/:workspaceId/:requestId/:exampleId",
  asyncHandler(async (req, res) => {
    getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    deleteExample(req.params.exampleId!);
    res.json({ ok: true });
  }),
);