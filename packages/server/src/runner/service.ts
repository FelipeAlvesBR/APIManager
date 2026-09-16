import {
  type ApiRequest,
  type AuthConfig,
  type Collection,
  type HeaderEntry,
  type VariableDefinition,
} from "@apiplatform/shared";
import { getCollection } from "../collections/service.js";
import { getGlobalVariables, getEnvironment } from "../environments/service.js";
import { listSecretsInternal } from "../secrets/service.js";
import { queryOne, queryAll } from "../db/connection.js";
import type { ExecutionDefinition } from "./executor.js";

export interface InheritedContext {
  auth: AuthConfig | undefined;
  headers: HeaderEntry[];
  scripts: { prerequest: string[]; test: string[] };
  collectionVariables: VariableDefinition[];
}

interface FolderLike {
  auth?: AuthConfig | null;
  events?: { prerequest?: string; test?: string };
}

function authOrUndefined(auth: AuthConfig | null | undefined): AuthConfig | undefined {
  return auth ?? undefined;
}

export function compileInherited(
  collection: Collection | undefined,
  folder: FolderLike | undefined,
  request: ApiRequest,
): InheritedContext {
  const scripts = {
    prerequest: [
      collection?.events?.prerequest,
      (folder as FolderLike | undefined)?.events?.prerequest,
      request.events?.prerequest,
    ].filter((s): s is string => Boolean(s)),
    test: [
      collection?.events?.test,
      (folder as FolderLike | undefined)?.events?.test,
      request.events?.test,
    ].filter((s): s is string => Boolean(s)),
  };

  return {
    auth: authOrUndefined(request.auth) ?? authOrUndefined((folder as FolderLike | undefined)?.auth) ?? authOrUndefined(collection?.auth),
    headers: collection?.defaultHeaders ?? [],
    scripts,
    collectionVariables: collection?.variables ?? [],
  };
}

export function getFolder(folderId: string | null | undefined) {
  if (!folderId) return undefined;
  const row = queryOne<{
    id: string; name: string; auth: string | null; prerequest_script: string | null; test_script: string | null; parent_folder_id: string | null;
  }>("SELECT * FROM folders WHERE id = ?", folderId);
  if (!row) return undefined;
  return {
    auth: row.auth ? (JSON.parse(row.auth) as AuthConfig) : undefined,
    events:
      row.prerequest_script || row.test_script
        ? { prerequest: row.prerequest_script ?? undefined, test: row.test_script ?? undefined }
        : undefined,
  };
}

export interface LoadContextOptions {
  request: ApiRequest;
  userId: string;
  workspaceId: string;
  environmentId?: string;
  data?: Record<string, string>;
  runtime?: Record<string, string>;
  cookies?: Record<string, string>;
}

export function loadExecutionDefinition(opts: LoadContextOptions): ExecutionDefinition {
  const { request, workspaceId } = opts;

  let collection: Collection | undefined;
  if (request.collectionId) {
    collection = getCollection(opts.userId, workspaceId, request.collectionId);
  }
  const folder = getFolder(request.folderId);
  const inherited = compileInherited(collection, folder, request);

  const environment = opts.environmentId
    ? getEnvironment(opts.userId, workspaceId, opts.environmentId).variables
    : [];
  const globals = getGlobalVariables(opts.userId, workspaceId);
  const secrets = listSecretsInternal(workspaceId);

  return {
    request,
    workspaceId,
    environmentId: opts.environmentId,
    environmentName: opts.environmentId ? getEnvironment(opts.userId, workspaceId, opts.environmentId).name : undefined,
    environmentVariables: environment,
    collectionVariables: inherited.collectionVariables,
    globalVariables: globals,
    secrets,
    runtime: opts.runtime ?? {},
    data: opts.data,
    scripts: inherited.scripts,
    inheritedHeaders: inherited.headers,
    cookies: opts.cookies,
  };
}

export function applyInheritedAuth(
  request: ApiRequest,
  collection: Collection | undefined,
  folderId: string | null | undefined,
): Promise<{ request: ApiRequest; collection: Collection | undefined }> {
  let folder: FolderLike | undefined;
  if (request.collectionId && folderId) {
    folder = getFolder(folderId);
  }
  const inherited = compileInherited(collection, folder, request);
  return Promise.resolve({
    request: { ...request, auth: inherited.auth ?? request.auth },
    collection,
  });
}

export function listCollectionRequests(collectionId: string): ApiRequest[] {
  const rows = queryAll<{
    id: string; name: string; method: string; url: string; folder_id: string | null; sort_order: number;
  }>(
    "SELECT id, name, method, url, folder_id, sort_order FROM requests WHERE collection_id = ? ORDER BY sort_order ASC, name ASC",
    collectionId,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    method: r.method,
    url: r.url,
    folderId: r.folder_id ?? undefined,
  })) as ApiRequest[];
}