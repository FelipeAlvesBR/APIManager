import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { newId, nowIso, type ApiRequest, type Collection, type HeaderEntry } from "@apiplatform/shared";
import { createCollection, createFolder as createFolderService } from "../collections/service.js";
import { createRequest } from "../requests/service.js";
import { validateOpenApi } from "../spec/service.js";

export interface ImportResult {
  collection?: Collection;
  requests: ApiRequest[];
  warnings: string[];
  secretsFound: string[];
  detectedFormat: string;
}

// ---------------- cURL ----------------

export interface ParsedCurl {
  method: string;
  url: string;
  headers: HeaderEntry[];
  body: string | null;
  bodyMode: "raw" | "urlencoded" | "formdata" | "none";
  auth?: { type?: "basic" | "bearer"; value?: string };
}

const METHOD_ALIASES: Record<string, string> = {
  "--request": "method", "-X": "method",
  "--header": "header", "-H": "header",
  "--data": "data", "-d": "data", "--data-raw": "data", "--data-binary": "data",
  "--data-urlencode": "urlencoded", "--data-ascii": "data",
  "--user": "user", "-u": "user",
  "--form": "form", "-F": "form",
  "--cookie": "cookie",
};

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input);
  let method = "GET";
  let url = "";
  const headers: HeaderEntry[] = [];
  let data: string | null = null;
  let bodyMode: ParsedCurl["bodyMode"] = "none";
  const urlencoded: [string, string][] = [];
  const form: [string, string][] = [];
  const auth: { type?: "basic" | "bearer"; value?: string } = {};

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const key = token.split("=")[0]!;
    if (key === "--url") {
      url = token.slice("--url".length + 1);
      continue;
    }
    if (token === "-X" || token === "--request") {
      method = tokens[++i]?.replace(/^['"]|['"]$/g, "").toUpperCase() ?? "GET";
      continue;
    }
    if (token.startsWith("-X") || token.startsWith("--request=")) {
      method = token.replace(/^(--request=|-X)/, "").replace(/^['"]|['"]$/g, "").toUpperCase();
      continue;
    }
    if (token === "-H" || token === "--header") {
      const raw = tokens[++i] ?? "";
      const parsed = parseHeader(raw);
      if (parsed) headers.push(parsed);
      continue;
    }
    if (token.startsWith("-H") || token.startsWith("--header=")) {
      const raw = token.replace(/^(--header=|-H)/, "");
      const parsed = parseHeader(raw);
      if (parsed) headers.push(parsed);
      continue;
    }
    if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary" || token === "--data-ascii") {
      data = tokens[++i] ?? "";
      if (bodyMode === "none") bodyMode = "raw";
      continue;
    }
    if (token.startsWith("--data")) {
      data = token.replace(/^--data(-\w+)?=/, "");
      if (bodyMode === "none") bodyMode = "raw";
      continue;
    }
    if (token === "--data-urlencode") {
      const pair = parsePair(tokens[++i] ?? "");
      if (pair) urlencoded.push(pair);
      bodyMode = "urlencoded";
      continue;
    }
    if (token === "-u" || token === "--user") {
      auth.type = "basic";
      auth.value = tokens[++i];
      continue;
    }
    if (token.startsWith("-u") || token.startsWith("--user=")) {
      auth.type = "basic";
      auth.value = token.replace(/^(--user=|-u)/, "");
      continue;
    }
    if (token === "-F" || token === "--form") {
      const pair = parsePair(tokens[++i] ?? "");
      if (pair) form.push(pair);
      bodyMode = "formdata";
      continue;
    }
    if (token.startsWith("-F") || token.startsWith("--form=")) {
      const pair = parsePair(token.replace(/^(--form=|-F)/, ""));
      if (pair) form.push(pair);
      bodyMode = "formdata";
      continue;
    }
    if (token === "-H" || token.startsWith("http")) {
      // fallthrough handled below
    }
    if (!token.startsWith("-")) {
      url = url || token.replace(/^['"]|['"]$/g, "");
    }
  }

  return { method, url, headers, body: data, bodyMode, auth };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  let match;
  while ((match = re.exec(input)) !== null) tokens.push(match[0]);
  return tokens;
}

function parseHeader(raw: string): HeaderEntry | undefined {
  const idx = raw.indexOf(":");
  if (idx === -1) return undefined;
  return {
    key: raw.slice(0, idx).trim(),
    value: raw.slice(idx + 1).trim().replace(/^['"]|['"]$/g, ""),
    enabled: true,
  };
}

function parsePair(raw: string): [string, string] | undefined {
  const idx = raw.indexOf("=");
  if (idx === -1) return [raw, ""];
  return [raw.slice(0, idx), raw.slice(idx + 1).replace(/^['"]|['"]$/g, "")];
}

// ---------------- Postman collection ----------------

export interface PostmanCollectionParse {
  raw: unknown;
  name: string;
  description?: string;
  items: unknown[];
  variables?: unknown[];
  auth?: unknown;
}

function toBodyString(item: Record<string, unknown>): string | undefined {
  const request = item.request as Record<string, unknown> | undefined;
  return request?.body ? JSON.stringify(request.body) : undefined;
}

export function parsePostmanCollection(raw: string): PostmanCollectionParse {
  const doc = JSON.parse(raw);
  const info = (doc as Record<string, unknown>).info as Record<string, unknown> | undefined;
  return {
    raw: doc,
    name: info?.name ? String(info.name) : "Imported Collection",
    description: info?.description ? String(info.description) : undefined,
    items: Array.isArray((doc as Record<string, unknown>).item) ? ((doc as Record<string, unknown>).item as unknown[]) : [],
    variables: Array.isArray((doc as Record<string, unknown>).variable) ? ((doc as Record<string, unknown>).variable as unknown[]) : undefined,
    auth: (doc as Record<string, unknown>).auth,
  };
}

// ---------------- Importers (persist) ----------------

export function importCurl(userId: string, workspaceId: string, curl: string): ImportResult {
  const parsed = parseCurl(curl);
  const warnings: string[] = [];
  if (!parsed.url) throw Object.assign(new Error("No URL found in cURL command"), { status: 400 });

  let body;
  if (parsed.bodyMode === "urlencoded") {
    body = { mode: "urlencoded", urlencoded: [] };
  } else if (parsed.bodyMode === "formdata") {
    body = { mode: "formdata", formdata: [] };
  } else if (parsed.body) {
    body = { mode: "raw", raw: parsed.body };
  }

  const secretsFound: string[] = [];
  for (const h of parsed.headers) {
    if (/authorization|api[-_]?key|token|password/i.test(h.key)) secretsFound.push(h.key);
  }

  const collection = createCollection(userId, workspaceId, { name: "Imported from cURL" });
  const request = createRequest(userId, workspaceId, {
    name: `${parsed.method} ${shortUrl(parsed.url)}`,
    method: parsed.method,
    url: parsed.url,
    header: parsed.headers,
    body: body as never,
    collectionId: collection.id,
    auth: parsed.auth?.type === "basic" ? { type: "basic", username: parsed.auth.value?.split(":")[0] ?? "", password: parsed.auth.value?.split(":").slice(1).join(":") ?? "" } : undefined,
  });
  warnings.push(...warnings);
  return { collection, requests: [request], warnings, secretsFound, detectedFormat: "curl" };
}

export function importPostmanCollection(userId: string, workspaceId: string, raw: string): ImportResult {
  const parsed = parsePostmanCollection(raw);
  const warnings: string[] = [];
  const secretsFound: string[] = [];
  const collection = createCollection(userId, workspaceId, {
    name: parsed.name,
    description: parsed.description,
    variables: (parsed.variables ?? []).map((v) => {
      const rec = v as { key: string; value: string };
      return { name: rec.key, value: rec.value, enabled: true };
    }),
    auth: parsed.auth ? { ...(parsed.auth as object), type: ((parsed.auth as Record<string, unknown>).type as string) ?? "none" } as never : undefined,
  });
  const requests: ApiRequest[] = [];
  const folderStack: { id: string; parentId: string | null }[] = [];

  const walk = (items: unknown[], parentFolderId: string | null) => {
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      if (Array.isArray(rec.item)) {
        const folder = createFolderService(userId, workspaceId, collection.id, {
          name: String(rec.name ?? "Folder"),
          parentFolderId,
        });
        folderStack.push({ id: folder.id, parentId: parentFolderId });
        walk(rec.item as unknown[], folder.id);
      } else if (rec.request) {
        const req = rec.request as Record<string, unknown>;
        const url = normalizePostmanUrl(req.url);
        const header = req.header ? (req.header as HeaderEntry[]) : [];
        for (const h of header) if (/authorization|api[-_]?key|token|password/i.test(h.key)) secretsFound.push(h.key);
        const created = createRequest(userId, workspaceId, {
          name: String(rec.name ?? "Request"),
          method: String(req.method ?? "GET").toUpperCase(),
          url,
          header,
          body: req.body ? (req.body as never) : undefined,
          collectionId: collection.id,
          folderId: parentFolderId,
        });
        requests.push(created);
      }
    }
  };
  walk(parsed.items, null);
  return { collection, requests, warnings, secretsFound, detectedFormat: "postman" };
}

export function importOpenApi(userId: string, workspaceId: string, content: string, format: "openapi-json" | "openapi-yaml"): ImportResult {
  const doc = (format === "openapi-yaml" ? parseYaml(content) : JSON.parse(content)) as Record<string, unknown>;
  const validation = validateOpenApi(doc);
  const warnings = validation.issues.map((i) => `${i.severity.toUpperCase()}: ${i.message}`);

  const info = (doc.info as Record<string, unknown>) ?? {};
  const collection = createCollection(userId, workspaceId, {
    name: String(info.title ?? "OpenAPI Collection"),
    description: String(info.description ?? ""),
  });
  const servers = (doc.servers as { url?: string }[] | undefined) ?? [];
  const baseUrl = servers[0]?.url?.replace(/\/$/, "") ?? "";
  const requests: ApiRequest[] = [];

  const paths = (doc.paths ?? {}) as Record<string, Record<string, unknown>>;
  const methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of methods) {
      const op = item?.[method] as Record<string, unknown> | undefined;
      if (!op) continue;
      const name = String(op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`);
      const header: HeaderEntry[] = [];
      const query: { key: string; value: string; enabled: boolean }[] = [];
      const params = (op.parameters as Record<string, unknown>[] | undefined) ?? [];
      for (const p of params) {
        const entry = { key: String(p.name), value: "", enabled: true };
        if (p.in === "header") header.push(entry);
        if (p.in === "query") query.push(entry);
      }
      let body;
      if (op.requestBody) {
        const content = ((op.requestBody as Record<string, unknown>).content as Record<string, unknown>) ?? {};
        if (content["application/json"]) {
          const example = (((content["application/json"] as Record<string, unknown>).example ?? "{}") as string);
          body = { mode: "raw", raw: typeof example === "string" ? example : JSON.stringify(example, null, 2) };
        }
      }
      const created = createRequest(userId, workspaceId, {
        name,
        method: method.toUpperCase(),
        url: `${baseUrl}${replacePathParams(path)}`,
        header,
        query: query as never,
        body: body as never,
        collectionId: collection.id,
      });
      requests.push(created);
    }
  }
  return { collection, requests, warnings, secretsFound: [], detectedFormat: format };
}

function normalizePostmanUrl(url: unknown): string {
  if (typeof url === "string") return url;
  if (url && typeof url === "object") {
    const u = url as Record<string, unknown>;
    if (typeof u.raw === "string") return u.raw;
  }
  return "";
}

function replacePathParams(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

function shortUrl(url: string): string {
  try { return new URL(url).pathname || url; } catch { return url; }
}

// ---------------- Export ----------------

export function exportPostmanCollection(collection: Collection, folders: unknown[], requests: ApiRequest[]): string {
  const doc = {
    info: {
      name: collection.name,
      description: collection.description ?? "",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: collection.variables?.map((v) => ({ key: v.name, value: v.value })),
    item: buildItems(folders, requests),
  };
  return JSON.stringify(doc, null, 2);
}

function buildItems(folders: unknown[], requests: ApiRequest[]): unknown[] {
  const folderList = folders as { id: string; name: string; parent_folder_id?: string | null }[];
  const byParent = new Map<string | undefined, (typeof folderList)[number][]>();
  const folderById = new Map<string, (typeof folderList)[number]>();
  for (const f of folderList) folderById.set(f.id, f);
  for (const f of folderList) {
    const parent = f.parent_folder_id ?? null;
    const key = parent ?? "__root__";
    byParent.set(key, [...(byParent.get(key) ?? []), f]);
  }

  const buildFolder = (parentId: string | null): unknown[] => {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) ?? [];
    const out: unknown[] = [];
    for (const f of children) {
      out.push({ name: f.name, item: buildFolder(f.id) });
    }
    const folderRequests = requests.filter((r) => r.folderId === parentId);
    for (const r of folderRequests) out.push(exportRequest(r));
    return out;
  };

  const rootFolders = buildFolder(null);
  const rootRequests = requests.filter((r) => !r.folderId);
  return [...rootFolders, ...rootRequests.map(exportRequest)];
}

function exportRequest(r: ApiRequest): Record<string, unknown> {
  return {
    name: r.name,
    request: {
      method: r.method,
      url: r.url,
      header: r.header,
      body: r.body,
      auth: r.auth,
      description: r.description,
    },
  };
}

// ---------------- Code snippet export helpers ----------------

export { newId, nowIso };