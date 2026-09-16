import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { ApiError } from "@apiplatform/shared";
import {
  exportPostmanCollection,
  importCurl,
  importPostmanCollection,
  importOpenApi,
} from "../importExport/service.js";
import { getCollection, listFolders } from "../collections/service.js";
import { listRequests } from "../requests/service.js";
import { generateSnippet, LANGUAGES, type SnippetLanguage } from "../codegen/service.js";

export const importExportRouter = Router();
importExportRouter.use(requireAuth);

const importSchema = z.object({
  type: z.enum(["curl", "postman", "openapi-json", "openapi-yaml"]),
  content: z.string(),
});

importExportRouter.post(
  "/import/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = importSchema.parse(req.body);
    let result;
    switch (input.type) {
      case "curl":
        result = importCurl(req.user!.id, req.params.workspaceId!, input.content);
        break;
      case "postman":
        result = importPostmanCollection(req.user!.id, req.params.workspaceId!, input.content);
        break;
      case "openapi-json":
        result = importOpenApi(req.user!.id, req.params.workspaceId!, input.content, "openapi-json");
        break;
      case "openapi-yaml":
        result = importOpenApi(req.user!.id, req.params.workspaceId!, input.content, "openapi-yaml");
        break;
      default:
        throw ApiError.badRequest("Unknown import type");
    }
    res.status(201).json(result);
  }),
);

importExportRouter.get(
  "/export/:workspaceId/:collectionId",
  asyncHandler(async (req, res) => {
    const collection = getCollection(req.user!.id, req.params.workspaceId!, req.params.collectionId!);
    const folders = listFolders(req.params.workspaceId!, req.params.collectionId!);
    const requests = listRequests(req.user!.id, req.params.workspaceId!, req.params.collectionId!);
    const json = exportPostmanCollection(collection, folders, requests);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${collection.name}.collection.json"`);
    res.send(json);
  }),
);

const codegenSchema = z.object({
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()).default({}),
  body: z.string().nullable().optional(),
  language: z.string(),
});

importExportRouter.post(
  "/codegen/:workspaceId",
  asyncHandler(async (req, res) => {
    const input = codegenSchema.parse(req.body);
    const language = LANGUAGES.includes(input.language as SnippetLanguage)
      ? (input.language as SnippetLanguage)
      : "curl";
    const snippet = generateSnippet(language, { method: input.method, url: input.url, headers: input.headers, body: input.body ?? null });
    res.json({ language, snippet });
  }),
);