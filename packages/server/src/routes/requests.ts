import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import {
  createRequest,
  deleteRequest,
  duplicateRequest,
  getRequest,
  listRequests,
  updateRequest,
} from "../requests/service.js";
import { loadExecutionDefinition } from "../runner/service.js";
import { executeRequest } from "../runner/executor.js";
import { recordHistory, buildResponseSummary } from "../history/service.js";
import { saveExample } from "../examples/service.js";

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

const headerSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
});

const querySchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  encode: z.boolean().optional(),
});

const bodySchema = z.object({
  mode: z.string(),
  raw: z.string().optional(),
  json: z.string().optional(),
  urlencoded: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })).optional(),
  formdata: z.array(z.object({ key: z.string(), value: z.string(), type: z.string().default("text"), fileName: z.string().optional(), contentType: z.string().optional(), enabled: z.boolean().default(true) })).optional(),
  binary: z.string().optional(),
  graphql: z.object({ query: z.string(), variables: z.string().optional() }).optional(),
});

const authSchema = z.object({ type: z.string() }).passthrough().nullable();

const requestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  method: z.string().min(1),
  url: z.string().min(1),
  header: z.array(headerSchema).optional(),
  query: z.array(querySchema).optional(),
  body: bodySchema.optional(),
  auth: authSchema.optional(),
  settings: z.object({
    followRedirects: z.boolean().optional(),
    timeoutMs: z.number().optional(),
    followOriginalMethod: z.boolean().optional(),
    retryCount: z.number().optional(),
  }).passthrough().optional(),
  events: z.object({ prerequest: z.string().optional(), test: z.string().optional() }).optional(),
  collectionId: z.string().optional(),
  folderId: z.string().nullable().optional(),
});

requestsRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const requests = listRequests(req.user!.id, req.params.workspaceId!, req.query.collectionId as string | undefined);
    res.json({ requests });
  }),
);

requestsRouter.post(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = requestSchema.parse(req.body);
    const request = createRequest(req.user!.id, req.params.workspaceId!, input as never);
    res.status(201).json({ request });
  }),
);

requestsRouter.get(
  "/:workspaceId/:requestId",
  asyncHandler(async (req, res) => {
    const request = getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    res.json({ request });
  }),
);

requestsRouter.patch(
  "/:workspaceId/:requestId",
  asyncHandler(async (req, res) => {
    const current = getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    const input = requestSchema.partial().parse(req.body);
    const request = updateRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!, {
      name: input.name ?? current.name,
      method: input.method ?? current.method,
      url: input.url ?? current.url,
      description: input.description ?? current.description,
      header: input.header ?? current.header,
      query: input.query ?? current.query,
      body: input.body ?? current.body,
      auth: input.auth ?? current.auth,
      settings: input.settings ?? current.settings,
      events: input.events ?? current.events,
      collectionId: input.collectionId ?? current.collectionId,
      folderId: input.folderId !== undefined ? input.folderId : current.folderId ?? null,
    } as never);
    res.json({ request });
  }),
);

requestsRouter.delete(
  "/:workspaceId/:requestId",
  asyncHandler(async (req, res) => {
    deleteRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    res.json({ ok: true });
  }),
);

requestsRouter.post(
  "/:workspaceId/:requestId/duplicate",
  asyncHandler(async (req, res) => {
    const request = duplicateRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    res.status(201).json({ request });
  }),
);

const sendSchema = z.object({
  environmentId: z.string().optional(),
  runtime: z.record(z.string()).optional(),
  saveAsExample: z.boolean().optional(),
});

requestsRouter.post(
  "/:workspaceId/:requestId/send",
  asyncHandler(async (req, res) => {
    const input = sendSchema.parse(req.body);
    const request = getRequest(req.user!.id, req.params.workspaceId!, req.params.requestId!);
    const def = loadExecutionDefinition({
      request,
      userId: req.user!.id,
      workspaceId: req.params.workspaceId!,
      environmentId: input.environmentId,
      runtime: input.runtime,
    });
    const result = await executeRequest(def);

    recordHistory({
      workspaceId: req.params.workspaceId!,
      collectionId: request.collectionId,
      environmentId: input.environmentId,
      method: result.finalRequest.method,
      url: result.finalRequest.url,
      status: result.response.status,
      duration: result.response.durationMs,
      responseSummary: buildResponseSummary(result.response),
    });

    if (input.saveAsExample && result.response.status !== null) {
      const example = saveExample({
        requestId: request.id,
        status: result.response.status,
        statusText: result.response.statusText,
        headers: result.response.headers,
        body: result.response.body,
      });
      return res.json({ response: result.response, request: result.finalRequest, tests: result.response.tests, example });
    }

    res.json({ response: result.response, request: result.finalRequest, tests: result.response.tests });
  }),
);