import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import {
  createEnvironment,
  deleteEnvironment,
  duplicateEnvironment,
  getEnvironment,
  getGlobalVariables,
  listEnvironments,
  setGlobalVariables,
  updateEnvironment,
} from "../environments/service.js";
import {
  deleteSecret,
  getSecretValue,
  listSecrets,
  setSecret,
} from "../secrets/service.js";

export const environmentsRouter = Router();
environmentsRouter.use(requireAuth);

const variableSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  secret: z.boolean().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

const envSchema = z.object({
  name: z.string().min(1),
  variables: z.array(variableSchema).optional(),
});

// Listing + creation
environmentsRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const environments = listEnvironments(req.user!.id, req.params.workspaceId!);
    res.json({ environments });
  }),
);

environmentsRouter.post(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = envSchema.parse(req.body);
    const environment = createEnvironment(req.user!.id, req.params.workspaceId!, input);
    res.status(201).json({ environment });
  }),
);

// Globals (must be registered before ":environmentId" routes)
environmentsRouter.get(
  "/:workspaceId/globals",
  asyncHandler(async (req, res) => {
    const globals = getGlobalVariables(req.user!.id, req.params.workspaceId!);
    res.json({ variables: globals });
  }),
);

environmentsRouter.put(
  "/:workspaceId/globals",
  asyncHandler(async (req, res) => {
    const variables = z.array(variableSchema).parse(req.body.variables);
    const result = setGlobalVariables(req.user!.id, req.params.workspaceId!, variables);
    res.json({ variables: result });
  }),
);

// Secrets (must be registered before ":environmentId" routes)
environmentsRouter.get(
  "/:workspaceId/secrets",
  asyncHandler(async (req, res) => {
    const secrets = listSecrets(req.user!.id, req.params.workspaceId!);
    res.json({ secrets });
  }),
);

environmentsRouter.put(
  "/:workspaceId/secrets/:key",
  asyncHandler(async (req, res) => {
    const value = z.string().parse(req.body.value);
    const secret = setSecret(req.user!.id, req.params.workspaceId!, req.params.key!, value);
    res.json({ secret });
  }),
);

environmentsRouter.post(
  "/:workspaceId/secrets/:key/reveal",
  asyncHandler(async (req, res) => {
    const value = getSecretValue(req.user!.id, req.params.workspaceId!, req.params.key!);
    res.json({ value });
  }),
);

environmentsRouter.delete(
  "/:workspaceId/secrets/:key",
  asyncHandler(async (req, res) => {
    deleteSecret(req.user!.id, req.params.workspaceId!, req.params.key!);
    res.json({ ok: true });
  }),
);

// Single-environment operations
environmentsRouter.get(
  "/:workspaceId/:environmentId",
  asyncHandler(async (req, res) => {
    const environment = getEnvironment(req.user!.id, req.params.workspaceId!, req.params.environmentId!);
    res.json({ environment });
  }),
);

environmentsRouter.patch(
  "/:workspaceId/:environmentId",
  asyncHandler(async (req, res) => {
    const input = envSchema.partial().parse(req.body);
    const environment = updateEnvironment(req.user!.id, req.params.workspaceId!, req.params.environmentId!, input);
    res.json({ environment });
  }),
);

environmentsRouter.delete(
  "/:workspaceId/:environmentId",
  asyncHandler(async (req, res) => {
    deleteEnvironment(req.user!.id, req.params.workspaceId!, req.params.environmentId!);
    res.json({ ok: true });
  }),
);

environmentsRouter.post(
  "/:workspaceId/:environmentId/duplicate",
  asyncHandler(async (req, res) => {
    const environment = duplicateEnvironment(req.user!.id, req.params.workspaceId!, req.params.environmentId!);
    res.status(201).json({ environment });
  }),
);