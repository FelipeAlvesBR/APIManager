# Testing

## Commands

```bash
npm run test -w @apiplatform/shared   # variable resolution + error helpers
npm run test -w @apiplatform/server   # unit (auth, url, codegen, redaction, body)
                                      # + integration (API + SQLite + sandbox)
npm test                              # all packages
npm run typecheck                     # all packages
npm run build                         # production builds
```

## Unit tests

`packages/server/test/unit.test.ts` covers:

- auth resolution (bearer, basic, api-key header/query, none)
- URL building (query merge, existing-query preservation), parsing, validation
- code generation (curl, python)
- AI secret redaction (authorization, API keys, JWTs, benign text, header names)
- body serialization (json, urlencoded, none)

`packages/shared/test/variables.test.ts` covers variable resolution:
scope precedence (environment > collection, runtime > global), unresolved
variable detection, multiple references.

## Integration tests

`packages/server/test/integration.test.ts` runs against a real Express app on
an in-memory SQLite database and a local HTTP echo server:

- register/login, wrong-password rejection, missing-token rejection
- tenant isolation (user B cannot read user A's workspace)
- create collection + request
- send a request → 200, history recorded
- environment variable resolution (`{{baseUrl}}`)
- test scripts with assertions (`pm.response.to.have.status(200)`, `pm.expect`)
- infinite-loop script is killed without hanging the server
- secret vault: store, list-without-leak, audited reveal
- mock endpoint: deterministic response matching

All **30 tests pass** (19 unit + 11 integration) on a clean `npm install`.

## E2E report

The full 128-scenario Playwright suite from the specification is **not yet
implemented**. What exists today is verified by the integration tests above,
plus these manual/CLI checks:

| Area | Verified |
| --- | --- |
| Account/workspace | register, login, personal workspace, tenant isolation, delete |
| Requests | GET, POST JSON, variable resolution, redirect handling, timeout/abort, malformed URL |
| Scripts/tests | pre/post scripts, assertions pass/fail, infinite-loop kill, log capture |
| History | records environment, filters, replay |
| Variables | environment > collection > global precedence, dynamic vars, vault secrets |
| Collections | save-to-collection, runner (iterations, data, stop-on-failure), export/import |
| Mocks | create from collection, deterministic route matching |
| Monitors | create, trigger run, record results |
| AI/BYO | provider CRUD (vault-stored keys), 7-step health test, redacted chat, policy |
| CLI | login/whoami, workspace/collection/environment list, `collection run` with junit reporter + exit codes |

## Known limitations

1. **Real-time collaboration** (WebSocket presence, comments, live cursors) is
   not implemented; collaboration is limited to shared workspaces + RBAC.
2. **Git integration** (native git, pull/push/PRs), **OAuth 2.0 authorization-
   code flow**, **GraphQL/WebSocket/gRPC clients**, **response visualizer**,
   **traffic capture**, and **performance testing** are documented in the spec
   but not shipped in this MVP.
3. The **MCP server** and a fully autonomous **Agent Mode** (tool execution)
   are designed in the AI service (tool definitions + chat) but not exposed as
   an MCP endpoint yet.
4. **Digest auth** and **AWS SigV4** are implemented as best-effort helpers;
   OAuth1/Hawk/NTLM return a clear "not supported" error.
5. OpenAPI validation is structural; no full JSON-Schema compilation.
6. In-memory rate limiting and the monitor scheduler are single-process.
7. Multipart uploads support text + base64 file fields (no disk-backed file
   picker in the browser MVP).
8. The web UI focuses on the P0 core surface; some P1/P2 admin screens are
   represented as API actions rather than full dedicated UIs.