# Architecture

## Overview

API Platform is a **modular monolith** with three applications sharing one
domain model (`@apiplatform/shared`) and one persistence layer (SQLite via
Node's built-in `node:sqlite`).

```
┌────────────────────┐      ┌─────────────────────────────────────────────┐
│  Web app (Vite)    │      │  API server (Express + TS)                  │
│  React + Zustand   │ ───► │  ┌───────────────────────────────────────┐  │
│  Monaco editors    │  /api │  │ domain modules                       │  │
│                    │      │  │  auth · workspaces · collections ·    │  │
└────────────────────┘      │  │  requests · environments · secrets ·  │  │
                            │  │  runner · mocks · monitors · specs ·  │  │
┌────────────────────┐      │  │  import/export · codegen · ai          │  │
│  CLI (apiplatform) │ ───► │  └───────────────┬───────────────────────┘  │
└────────────────────┘      │                  │ SQLite (node:sqlite)    │
                            │  Worker threads ─┴─ scripting sandbox      │
                            └─────────────────────────────────────────────┘
```

## Engineering principles (from the spec)

- **Server is authoritative** for shared state; the client keeps working on
  transient network loss (requests can still be composed; sends require the
  target endpoint to be reachable).
- **Idempotent writes** where possible; every resource has an immutable `id`,
  `createdAt`/`updatedAt`, and `version` for optimistic concurrency.
- **Auditable mutations** — every mutation writes an `audit_events` row.
- **No secrets in logs** — the logger exposes a `redact()` helper and never
  receives raw secret values.
- **Script isolation** — user scripts run in a worker thread inside a `node:vm`
  context with a timeout; the worker is terminated on timeout/infinite loops.
  Scripts have no filesystem access, no child-process access and no access to
  server credentials. Script HTTP is limited to `pm.sendRequest`.
- **Cancellation/timeouts/retries** — request execution supports abort signals,
  timeouts, redirect limits and redirect-loop detection.

## Repository structure

```
packages/shared/src/
  types.ts       — domain entities and enums
  variables.ts   — variable reference parsing + scope-precedence resolution
  errors.ts      — ApiError, status phrases/classification
  id.ts          — id/uuid/now helpers (browser + node safe)

packages/server/src/
  index.ts            — bootstrap: migrate, seed, listen, start monitor scheduler
  config.ts           — environment-driven config (+ tiny .env loader)
  logger.ts           — structured logger + redaction helper
  db/                 — SQLite connection, migrations (schema.ts), seed.ts
  http/               — express app factory, auth middleware, error handler,
                        rate limiter
  auth/               — register/login, JWT, password hashing
  workspaces/         — workspaces + members + RBAC (access.ts)
  collections/        — collections + folders
  requests/           — requests CRUD + duplicate
  environments/       — environments + global variables
  secrets/            — AES-256-GCM secret vault
  runner/             — request execution pipeline, variable context, auth
                        resolution, body serialization, url utils, script
                        sandbox, collection runner
  history/            — request history with filters
  examples/           — saved response examples
  mocks/              — mock servers + public mock endpoint
  monitors/           — monitors + scheduler
  spec/               — specs + OpenAPI validation
  importExport/       — cURL / Postman / OpenAPI importers + exporters
  codegen/            — snippet generation (12 languages)
  ai/                 — BYO providers, policy, chat client, secret redaction
  audit/              — audit events
  routes/             — HTTP route modules

packages/web/src/
  main.tsx / App.tsx  — entry, auth gate, router
  store.ts            — Zustand app store
  api.ts              — typed API client
  pages/              — AuthPage, WorkspaceShell
  components/         — TopBar, Sidebar, RequestBuilder, BodyEditor,
                        AuthEditor, ResponseViewer, EnvironmentsPanel,
                        CommandPalette, AiPanel, KeyValueEditor, Toasts

packages/cli/src/
  index.ts            — `apiplatform` command tree
```

## Request execution pipeline

1. Build a variable context (runtime → data → environment → collection →
   global → dynamic/system) plus an in-memory secret map from the vault.
2. Run **pre-request scripts** (collection → folder → request) in the sandbox;
   variable mutations are merged back.
3. Validate the resolved URL.
4. Resolve headers, body and auth (request > folder > collection inheritance).
5. Execute the network request with redirect control, timeout and abort
   support; capture metrics and a size-limited response snapshot.
6. Run **post-response scripts / tests** in the sandbox; assertions and console
   output are attached to the snapshot.
7. Record history and (optionally) a saved example.

## Scripting sandbox

`runner/sandbox.ts` spawns a `Worker` (via `new Worker(code, { eval: true })`).
The worker builds a `node:vm` context exposing only `pm`, a captured `console`
and safe globals. The parent terminates the worker if it exceeds the script
timeout, which reliably kills infinite loops. `pm.sendRequest` uses the worker's
native `fetch`; pending async work is drained before results are posted back.

## Data model highlights

Every entity has `id`, `created_at`, `updated_at` and `version`. Key tables:
`users`, `workspaces`, `workspace_members`, `collections`, `folders`,
`requests`, `environments`, `globals`, `secrets` (ciphertext), `history`,
`examples`, `runs`, `run_items`, `mocks`, `monitors`, `monitor_runs`, `specs`,
`comments`, `documents`, `ai_providers`, `ai_conversations`, `ai_messages`,
`audit_events`. See [docs/API.md](docs/API.md#data-model) for column details.

## Concurrency

Collaborative entities use optimistic concurrency (`version`). Workspace
membership is read live from the database for every authorization decision, so
revoked roles take effect immediately (stateless JWTs with a token version).