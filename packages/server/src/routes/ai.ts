import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { ApiError } from "@apiplatform/shared";
import {
  createProvider,
  deleteProvider,
  getAiPolicy,
  getProvider,
  listProviders,
  safeChat,
  testProviderConnection,
  type ChatMessage,
  chatCompletion,
} from "../ai/service.js";
import { updateWorkspace } from "../workspaces/service.js";
import { config } from "../config.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const providerSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  apiFormat: z.enum(["openai", "ollama", "custom"]).default("openai"),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  contextWindow: z.number().int().optional(),
  toolCalls: z.boolean().optional(),
  streaming: z.boolean().optional(),
  temperature: z.number().optional(),
  maxOutputTokens: z.number().int().optional(),
  region: z.string().optional(),
  dataRetention: z.string().optional(),
  workspaceScoped: z.boolean().optional(),
});

aiRouter.get(
  "/:workspaceId/providers",
  asyncHandler(async (req, res) => {
    const providers = listProviders(req.user!.id, req.params.workspaceId!);
    res.json({ providers });
  }),
);

aiRouter.post(
  "/:workspaceId/providers",
  asyncHandler(async (req, res) => {
    const input = providerSchema.parse(req.body);
    const provider = createProvider(req.user!.id, req.params.workspaceId!, input);
    res.status(201).json({ provider });
  }),
);

aiRouter.get(
  "/:workspaceId/providers/:providerId",
  asyncHandler(async (req, res) => {
    const provider = getProvider(req.user!.id, req.params.workspaceId!, req.params.providerId!);
    if (!provider) throw ApiError.notFound("Provider not found");
    res.json({ provider });
  }),
);

aiRouter.delete(
  "/:workspaceId/providers/:providerId",
  asyncHandler(async (req, res) => {
    deleteProvider(req.user!.id, req.params.workspaceId!, req.params.providerId!);
    res.json({ ok: true });
  }),
);

aiRouter.post(
  "/:workspaceId/providers/:providerId/test",
  asyncHandler(async (req, res) => {
    const result = await testProviderConnection(req.params.workspaceId!, req.params.providerId!, req.user!.id);
    res.json(result);
  }),
);

const chatSchema = z.object({
  providerId: z.string(),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })),
  temperature: z.number().optional(),
  maxTokens: z.number().int().optional(),
  tools: z.array(z.unknown()).optional(),
  redact: z.boolean().optional().default(true),
});

aiRouter.post(
  "/:workspaceId/chat",
  asyncHandler(async (req, res) => {
    const input = chatSchema.parse(req.body);
    const provider = getProvider(req.user!.id, req.params.workspaceId!, input.providerId);
    if (!provider) throw ApiError.notFound("Provider not found");
    const messages: ChatMessage[] = input.messages;
    const result = input.redact
      ? await safeChat(req.params.workspaceId!, provider, messages, { temperature: input.temperature, maxTokens: input.maxTokens })
      : await chatCompletion(req.params.workspaceId!, provider, messages, { temperature: input.temperature, maxTokens: input.maxTokens });
    res.json({ content: result.content, redacted: input.redact && (result as { redacted?: boolean }).redacted });
  }),
);

// Policy (admin only)
aiRouter.get(
  "/:workspaceId/policy",
  asyncHandler(async (req, res) => {
    const policy = getAiPolicy(req.params.workspaceId!);
    res.json({ policy });
  }),
);

const policySchema = z.object({
  allowedBaseUrls: z.array(z.string()).optional(),
  blockPublicProviders: z.boolean().optional(),
  blockSecrets: z.boolean().optional(),
  requireRegion: z.string().optional(),
});

aiRouter.put(
  "/:workspaceId/policy",
  asyncHandler(async (req, res) => {
    const input = policySchema.parse(req.body);
    const { getWorkspace } = await import("../workspaces/service.js");
    const ws = getWorkspace(req.params.workspaceId!);
    if (!ws) throw ApiError.notFound("Workspace not found");
    const settings = ws.settings ? JSON.parse(ws.settings) : {};
    settings.aiPolicy = { ...settings.aiPolicy, ...input };
    updateWorkspace(req.user!.id, req.params.workspaceId!, { settings } as never);
    res.json({ policy: settings.aiPolicy });
  }),
);

export { config };