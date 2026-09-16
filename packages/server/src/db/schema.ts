export interface Migration {
  version: number;
  name: string;
  up: string;
}

/**
 * Ordered migration list. Append new migrations at the end and never edit an
 * already-released migration (rollback-safe guideline).
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial-schema",
    up: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'personal',
  owner_id TEXT NOT NULL,
  organization_id TEXT,
  settings TEXT,
  linked_git_repo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX idx_members_user ON workspace_members(user_id);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  workspace_id TEXT NOT NULL,
  auth TEXT,
  prerequest_script TEXT,
  test_script TEXT,
  default_headers TEXT,
  variables TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_collections_workspace ON collections(workspace_id);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  parent_folder_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  auth TEXT,
  prerequest_script TEXT,
  test_script TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_folders_collection ON folders(collection_id);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT,
  query TEXT,
  body TEXT,
  auth TEXT,
  settings TEXT,
  prerequest_script TEXT,
  test_script TEXT,
  collection_id TEXT,
  folder_id TEXT,
  workspace_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_requests_workspace ON requests(workspace_id);
CREATE INDEX idx_requests_collection ON requests(collection_id);

CREATE TABLE environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  variables TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_environments_workspace ON environments(workspace_id);

CREATE TABLE globals (
  workspace_id TEXT PRIMARY KEY,
  variables TEXT,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE secrets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_secrets_workspace ON secrets(workspace_id);

CREATE TABLE history (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  collection_id TEXT,
  environment_id TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status INTEGER,
  duration INTEGER,
  sent_at TEXT NOT NULL,
  response_summary TEXT
);
CREATE INDEX idx_history_workspace ON history(workspace_id, sent_at);

CREATE TABLE examples (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  name TEXT,
  status INTEGER,
  status_text TEXT,
  headers TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_examples_request ON examples(request_id);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  collection_id TEXT,
  summary TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_runs_workspace ON runs(workspace_id, started_at);

CREATE TABLE run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  request_id TEXT,
  name TEXT,
  method TEXT,
  url TEXT,
  status INTEGER,
  duration INTEGER,
  passed INTEGER,
  assertion_count INTEGER,
  skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  tests TEXT,
  logs TEXT
);
CREATE INDEX idx_run_items_run ON run_items(run_id);

CREATE TABLE mocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source_collection_id TEXT,
  routes TEXT,
  latency INTEGER DEFAULT 0,
  default_headers TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  environment_id TEXT,
  schedule TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  failure_threshold INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_run_passed INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE monitor_runs (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  passed INTEGER,
  status INTEGER,
  latency INTEGER,
  details TEXT,
  run_at TEXT NOT NULL
);
CREATE INDEX idx_monitor_runs ON monitor_runs(monitor_id, run_at);

CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_specs_workspace ON specs(workspace_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  mentions TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_comments_resource ON comments(resource_type, resource_id);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  collection_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  theme TEXT DEFAULT 'light',
  visibility TEXT DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  owner_id TEXT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_format TEXT NOT NULL DEFAULT 'openai',
  api_key_ref TEXT,
  model TEXT NOT NULL,
  context_window INTEGER NOT NULL DEFAULT 8192,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  streaming INTEGER NOT NULL DEFAULT 1,
  temperature REAL NOT NULL DEFAULT 0.2,
  max_output_tokens INTEGER NOT NULL DEFAULT 2048,
  region TEXT,
  data_retention TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider_id TEXT,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_workspace ON audit_events(workspace_id, created_at);
`,
  },
];