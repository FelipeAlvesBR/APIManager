import { Router } from "express";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import {
  createSpec,
  deleteSpec,
  getSpec,
  listSpecs,
  updateSpec,
  validateOpenApi,
} from "../spec/service.js";
import { newId } from "@apiplatform/shared";

export const specsRouter = Router();
specsRouter.use(requireAuth);

const specSchema = z.object({
  name: z.string().min(1),
  format: z.string().default("openapi"),
  content: z.string(),
});

specsRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const specs = listSpecs(req.user!.id, req.params.workspaceId!);
    res.json({ specs });
  }),
);

specsRouter.post(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = specSchema.parse(req.body);
    const spec = createSpec(req.user!.id, req.params.workspaceId!, input);
    res.status(201).json({ spec });
  }),
);

specsRouter.get(
  "/:workspaceId/:specId",
  asyncHandler(async (req, res) => {
    const spec = getSpec(req.user!.id, req.params.workspaceId!, req.params.specId!);
    res.json({ spec });
  }),
);

specsRouter.patch(
  "/:workspaceId/:specId",
  asyncHandler(async (req, res) => {
    const input = specSchema.partial().parse(req.body);
    const spec = updateSpec(req.user!.id, req.params.workspaceId!, req.params.specId!, input);
    res.json({ spec });
  }),
);

specsRouter.delete(
  "/:workspaceId/:specId",
  asyncHandler(async (req, res) => {
    deleteSpec(req.user!.id, req.params.workspaceId!, req.params.specId!);
    res.json({ ok: true });
  }),
);

specsRouter.post(
  "/:workspaceId/validate",
  asyncHandler(async (req, res) => {
    const content = z.string().parse(req.body.content);
    const format = z.string().optional().parse(req.body.format);
    let doc: unknown;
    try {
      doc = format === "yaml" || format === "openapi-yaml" ? parseYaml(content) : JSON.parse(content);
    } catch (e) {
      return res.json({ valid: false, issues: [{ severity: "error", message: `Failed to parse: ${(e as Error).message}`, path: "$" }], summary: { paths: 0, operations: 0, schemas: 0 } });
    }
    const result = validateOpenApi(doc);
    res.json(result);
  }),
);