export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "TRACE",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type BodyMode =
  | "none"
  | "raw"
  | "json"
  | "xml"
  | "javascript"
  | "html"
  | "formdata"
  | "urlencoded"
  | "binary"
  | "graphql";

export type AuthType =
  | "none"
  | "apikey"
  | "bearer"
  | "basic"
  | "digest"
  | "oauth1"
  | "oauth2"
  | "hawk"
  | "awsv4"
  | "ntlm"
  | "custom";

export type Visibility = "personal" | "team" | "private" | "public" | "partner";

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "editor"
  | "commenter"
  | "viewer";

export interface KeyValue {
  id?: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface FormField extends KeyValue {
  type: "text" | "file";
  fileName?: string;
  contentType?: string;
}

export interface UrlQueryParam extends KeyValue {
  encode?: boolean;
}

export interface HeaderEntry extends KeyValue {
  inherited?: boolean;
  overridden?: boolean;
}

export interface AuthConfig {
  type: AuthType;
  [key: string]: unknown;
}

export interface RequestBody {
  mode: BodyMode;
  raw?: string;
  json?: string;
  formdata?: FormField[];
  urlencoded?: KeyValue[];
  binary?: string;
  graphql?: { query: string; variables?: string };
}

export interface CollectionScripts {
  prerequest?: string;
  test?: string;
}

export interface ApiRequest {
  id: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  header?: HeaderEntry[];
  query?: UrlQueryParam[];
  body?: RequestBody;
  auth?: AuthConfig | null;
  settings?: RequestSettings;
  events?: CollectionScripts;
  collectionId?: string;
  folderId?: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RequestSettings {
  followRedirects?: boolean;
  timeoutMs?: number;
  proxy?: string;
  sslVerify?: boolean;
  followOriginalMethod?: boolean;
  retryCount?: number;
  maxRedirects?: number;
}

export interface CollectionFolder {
  id: string;
  name: string;
  description?: string;
  auth?: AuthConfig | null;
  events?: CollectionScripts;
  order: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  auth?: AuthConfig | null;
  events?: CollectionScripts;
  variables?: VariableDefinition[];
  defaultHeaders?: HeaderEntry[];
  order: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type VariableScope =
  | "runtime"
  | "data"
  | "environment"
  | "collection"
  | "global"
  | "system";

export interface VariableDefinition {
  name: string;
  value: string;
  secret?: boolean;
  type?: string;
  description?: string;
  enabled: boolean;
  scope?: VariableScope;
}

export interface Environment {
  id: string;
  name: string;
  workspaceId: string;
  variables: VariableDefinition[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ResponseExample {
  id: string;
  requestId: string;
  name: string;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  collectionId?: string;
  environmentId?: string;
  method: string;
  url: string;
  status: number | null;
  duration: number;
  sentAt: string;
  responseSummary: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface ScriptLog {
  level: "log" | "info" | "warn" | "error";
  message: string;
  ts: string;
}

export interface ScriptExecutionContext {
  variables: Record<string, string>;
  secretVariables: Set<string>;
}

export interface ResponseSnapshot {
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  sizeBytes: number;
  durationMs: number;
  requestId: string;
  remoteAddress?: string;
  protocol?: string;
  redirectedUrls?: string[];
  error?: { code: string; message: string };
  tests: TestResult[];
  logs: ScriptLog[];
  console: ScriptLog[];
}

export interface RunResult {
  id: string;
  collectionId?: string;
  runItemIds: string[];
  summary: RunSummary;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  startedAt: string;
}

export interface MockRoute {
  id: string;
  method: string;
  path: string;
  responses: MockResponse[];
}

export interface MockResponse {
  id: string;
  name: string;
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  body: string;
  delayMs: number;
}

export interface MonitorConfig {
  id: string;
  name: string;
  workspaceId: string;
  collectionId: string;
  environmentId?: string;
  schedule: string;
  timeoutMs: number;
  failureThreshold: number;
  enabled: boolean;
  lastRunAt?: string;
  lastRunPassed?: boolean;
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiFormat: "openai" | "ollama" | "custom";
  apiKey?: string;
  apiKeyRef?: string;
  model: string;
  contextWindow: number;
  toolCalls: boolean;
  streaming: boolean;
  temperature: number;
  maxOutputTokens: number;
  region?: string;
  dataRetention?: string;
  active: boolean;
}