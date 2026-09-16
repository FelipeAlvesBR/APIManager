import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import {
  createCollection,
  createFolder,
  deleteCollection,
  deleteFolder,
  getCollection,
  listCollections,
  listFolders,
  updateCollection,
} from "../collections/service.js";
import { listRequests } from "../requests/service.js";

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

const authSchema = z.object({ type: z.string(), extra: z.record(z.unknown()).optional() }).passthrough();
const variableSchema = z.object({
  name: z.string(),
  value: z.string(),
  secret: z.boolean().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

const collectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  auth: authSchema.nullable().optional(),
  events: z.object({ prerequest: z.string().optional(), test: z.string().optional() }).optional(),
  variables: z.array(variableSchema).optional(),
  defaultHeaders: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })).optional(),
});

const folderSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentFolderId: z.string().nullable().optional(),
});

collectionsRouter.get(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const collections = listCollections(req.user!.id, req.params.workspaceId!);
    res.json({ collections });
  }),
);

collectionsRouter.post(
  "/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = collectionSchema.parse(req.body);
    const collection = createCollection(req.user!.id, req.params.workspaceId!, input as never);
    res.status(201).json({ collection });
  }),
);

collectionsRouter.get(
  "/:workspaceId/:collectionId",
  asyncHandler(async (req, res) => {
    const collection = getCollection(req.user!.id, req.params.workspaceId!, req.params.collectionId!);
    const folders = listFolders(req.params.workspaceId!, req.params.collectionId!);
    const requests = listRequests(req.user!.id, req.params.workspaceId!, req.params.collectionId!);
    res.json({ collection, folders, requests });
  }),
);

collectionsRouter.patch(
  "/:workspaceId/:collectionId",
  asyncHandler(async (req, res) => {
    const input = collectionSchema.partial().parse(req.body);
    const collection = updateCollection(req.user!.id, req.params.workspaceId!, req.params.collectionId!, input as never);
    res.json({ collection });
  }),
);

collectionsRouter.delete(
  "/:workspaceId/:collectionId",
  asyncHandler(async (req, res) => {
    deleteCollection(req.user!.id, req.params.workspaceId!, req.params.collectionId!);
    res.json({ ok: true });
  }),
);

collectionsRouter.post(
  "/:workspaceId/:collectionId/folders",
  asyncHandler(async (req, res) => {
    const input = folderSchema.parse(req.body);
    const folder = createFolder(req.user!.id, req.params.workspaceId!, req.params.collectionId!, input);
    res.status(201).json({ folder });
  }),
);

collectionsRouter.delete(
  "/:workspaceId/:collectionId/folders/:folderId",
  asyncHandler(async (req, res) => {
    deleteFolder(req.user!.id, req.params.workspaceId!, req.params.collectionId!, req.params.folderId!);
    res.json({ ok: true });
  }),
);