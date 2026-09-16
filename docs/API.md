# API Reference

All endpoints are JSON. Authentication uses `Authorization: Bearer <token>`
except `/api/health`, `/api/auth/*` and `/mock/*`. Structured errors look like:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "reqid_…", "details": {} } }
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `VALIDATION_ERROR`, `RATE_LIMITED`, `TOO_LARGE`, `INTERNAL`.
Every response carries an `X-Request-Id` header (also echoed in errors).

## Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ email, name, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/api/auth/me` | — | `{ user }` |
| POST | `/api/auth/logout` | — | `{ ok: true }` |

Registration creates a personal workspace automatically.

## Workspaces

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/workspaces` | workspaces the user belongs to (includes `role`) |
| POST | `/api/workspaces` | `{ name, description?, visibility? }` |
| GET | `/api/workspaces/:wsId` | detail for members |
| PATCH | `/api/workspaces/:wsId` | admin+ |
| DELETE | `/api/workspaces/:wsId` | owner only, cascades all child data |
| GET | `/api/workspaces/:wsId/members` | member list with roles |
| POST | `/api/workspaces/:wsId/members` | `{ email, role }` (admin+) |
| PATCH | `/api/workspaces/:wsId/members/:userId` | change role (admin+) |
| DELETE | `/api/workspaces/:wsId/members/:userId` | remove (admin+) |
| GET | `/api/workspaces/:wsId/audit` | audit events (admin+) |

Roles: `owner` > `admin` > `editor` > `commenter` > `viewer`. Writes need
`editor`+, member management and settings need `admin`+, deletion needs
`owner`.

## Collections & folders

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/collections/:wsId` | list |
| POST | `/api/collections/:wsId` | `{ name, description?, auth?, events?, variables?, defaultHeaders? }` |
| GET | `/api/collections/:wsId/:collectionId` | collection + folders + requests |
| PATCH | `/api/collections/:wsId/:collectionId` | partial update |
| DELETE | `/api/collections/:wsId/:collectionId` | deletes folders + requests |
| POST | `/api/collections/:wsId/:collectionId/folders` | `{ name, parentFolderId? }` |
| DELETE | `/api/collections/:wsId/:collectionId/folders/:folderId` | deletes folder requests |

## Requests

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/requests/:wsId` | `?collectionId=` optional |
| POST | `/api/requests/:wsId` | save a request (collectionId optional) |
| GET | `/api/requests/:wsId/:requestId` | detail |
| PATCH | `/api/requests/:wsId/:requestId` | partial update |
| DELETE | `/api/requests/:wsId/:requestId` | delete |
| POST | `/api/requests/:wsId/:requestId/duplicate` | copy |
| POST | `/api/requests/:wsId/:requestId/send` | execute; body `{ environmentId?, runtime?, saveAsExample? }` → `{ response, request, tests, example? }` |

A request payload: `{ name, method, url, header[], query[], body{...},
auth{...}, settings{...}, events{ prerequest, test }, collectionId, folderId }`.

Response snapshot shape:

```json
{
  "status": 200, "statusText": "OK",
  "headers": {}, "cookies": {}, "body": "…",
  "sizeBytes": 123, "durationMs": 45, "requestId": "req_…",
  "remoteAddress": "api.example.com", "protocol": "https",
  "redirectedUrls": [], "tests": [{"name":"…","passed":true}], "logs": []
}
```

## Environments & globals & secrets

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/api/environments/:wsId` | list / create |
| GET / PATCH / DELETE | `/api/environments/:wsId/:envId` | CRUD |
| POST | `/api/environments/:wsId/:envId/duplicate` | clone |
| GET / PUT | `/api/environments/:wsId/globals` | workspace globals |
| GET | `/api/environments/:wsId/secrets` | secret keys only (never values) |
| PUT | `/api/environments/:wsId/secrets/:key` | `{ value }` — encrypted at rest |
| POST | `/api/environments/:wsId/secrets/:key/reveal` | returns value (audited) |
| DELETE | `/api/environments/:wsId/secrets/:key` | delete |

Variables: `{{name}}`; vault secrets: `{{$secret.key}}`; dynamic:
`{{$guid}}`, `{{$randomEmail}}`, `{{$timestamp}}`, etc.

## History & examples

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/history/:wsId` | filters: `method, status, host, collectionId, environmentId, success, from, to, search, sort` |
| DELETE | `/api/history/:wsId` | `{ ids: [...] }` bulk delete |
| POST | `/api/history/:wsId/clear` | clear all |
| POST | `/api/history/:wsId/:historyId/replay` | re-execute |
| GET / POST | `/api/examples/:wsId/:requestId` | list / save example |
| DELETE | `/api/examples/:wsId/:requestId/:exampleId` | delete example |

## Runs, mocks, monitors

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/runs/:wsId` | `{ collectionId, environmentId?, iterations?, delayMs?, data?, stopOnFailure?, folderId? }` → run report |
| GET | `/api/runs/:wsId` | run list |
| GET | `/api/runs/:wsId/:runId` | run detail with items |
| GET / POST | `/api/mocks/:wsId` | list / create mock |
| GET / DELETE | `/api/mocks/:wsId/:mockId` | detail / delete |
| ANY | `/mock/:mockId/*` | **public** mock endpoint |
| GET / POST | `/api/monitors/:wsId` | list / create monitor |
| GET / PATCH / DELETE | `/api/monitors/:wsId/:monitorId` | CRUD (PATCH accepts `enabled`) |
| POST | `/api/monitors/:wsId/:monitorId/run` | trigger run |
| GET | `/api/monitors/:wsId/:monitorId/runs` | run history |

## Specs, import/export, codegen

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/api/specs/:wsId` | list / create spec (`{ name, format, content }`) |
| GET / PATCH / DELETE | `/api/specs/:wsId/:specId` | CRUD |
| POST | `/api/specs/:wsId/validate` | `{ content, format }` → `{ valid, issues[], summary }` |
| POST | `/api/import/:wsId` | `{ type: curl\|postman\|openapi-json\|openapi-yaml, content }` |
| GET | `/api/export/:wsId/:collectionId` | Postman collection JSON (download) |
| POST | `/api/codegen/:wsId` | `{ method, url, headers, body, language }` → `{ snippet }` |

## AI (Bring-Your-Own-Model)

| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/api/ai/:wsId/providers` | list / create provider |
| GET / DELETE | `/api/ai/:wsId/providers/:providerId` | detail / delete |
| POST | `/api/ai/:wsId/providers/:providerId/test` | runs the 7-step health test |
| POST | `/api/ai/:wsId/chat` | `{ providerId, messages[], redact?, temperature?, maxTokens? }` |
| GET / PUT | `/api/ai/:wsId/policy` | admin provider policy (`allowedBaseUrls`, `blockSecrets`, `requireRegion`) |

Provider creation: `{ name, baseUrl, apiFormat: openai|ollama|custom, apiKey?,
model, temperature?, … }`. API keys are stored in the encrypted vault and never
returned by list endpoints.

## Data model

Schema is managed by versioned migrations in
`packages/server/src/db/schema.ts`. The main tables and their purpose:

| Table | Purpose |
| --- | --- |
| `users` | accounts (bcrypt hash, `token_version`) |
| `organizations`, `teams` | org scaffolding |
| `workspaces`, `workspace_members` | tenants + RBAC |
| `collections`, `folders`, `requests` | API assets |
| `environments`, `globals` | variable scopes |
| `secrets` | AES-256-GCM encrypted vault |
| `history` | request history |
| `examples` | saved responses |
| `runs`, `run_items` | collection runs |
| `mocks` | mock servers (routes JSON) |
| `monitors`, `monitor_runs` | scheduled monitors |
| `specs` | OpenAPI documents |
| `comments`, `documents` | collaboration/docs |
| `ai_providers`, `ai_conversations`, `ai_messages` | BYO-model AI |
| `audit_events` | mutation audit trail |