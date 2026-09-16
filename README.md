# API Platform

A privacy-first, Postman-like API development platform. It is an
original implementation — no Postman code, branding, or assets are reproduced.

The product covers the everyday API workflow:

- request builder (HTTP) with params, headers, bodies, auth helpers
- response viewer (pretty JSON tree, raw, headers, tests, console)
- collections, folders, environments, global variables and a **secret vault**
  (AES-256-GCM at rest)
- pre-request and post-response **JavaScript scripting** (`pm.*` API) with
  assertions, isolated in worker threads (infinite loops are killed)
- request history with rich filtering, collection runner (data-driven,
  stop-on-failure), saved response examples
- mock servers, scheduled monitors, OpenAPI specs, import/export
  (cURL, Postman Collection, OpenAPI), code snippet generation (12 languages)
- a **Bring-Your-Own-Model AI assistant**: connect any OpenAI-compatible
  endpoint (self-hosted Ollama, company gateway, public APIs) with automatic
  secret redaction before requests leave your client
- a command-line interface (`apiplatform`) with JUnit/HTML/JSON reporters
- multi-tenant workspaces with role-based access control and audit events

## Quick start

Requirements: **Node.js ≥ 20.6** (built-in `node:sqlite` is used — no native
compilation, no external database needed).

```bash
git clone <this repo>
cd APIManager
cp .env.example .env
npm install
npm run db:migrate
npm run seed
npm run dev
```

Then open <http://localhost:5173>.

- **Web app** — http://localhost:5173 (Vite dev server proxies `/api` to the API server on :4000)
- **API server** — http://localhost:4000
- **Demo account** (created by `npm run seed`) — `demo@apiplatform.dev` / `demo12345`

The demo workspace "Sample Commerce API" contains collections (Auth, Products,
Orders), three environments, tests, response examples, a mock server, an
OpenAPI spec and a monitor so you can explore without configuring anything.

## Package layout (monorepo)

```
packages/
  shared/   @apiplatform/shared   — domain types, variable resolution, errors
  server/   @apiplatform/server   — REST API, SQLite persistence, execution engine,
                                   scripting sandbox, mocks, monitors, specs, AI service
  web/      @apiplatform/web      — React + TypeScript single-page app (Vite)
  cli/      @apiplatform/cli      — `apiplatform` command-line tool
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture,
[docs/API.md](docs/API.md) for the API reference, and
[docs/SETUP.md](docs/SETUP.md) for deployment/backup instructions.

## Key workflows

1. **Send a request** — Ctrl/Cmd+K → *New request*, paste a URL, press Send (Ctrl/Cmd+Enter).
2. **Save to a collection** — the *Save to collection* action creates a collection and adds the request.
3. **Use variables** — `{{variableName}}` resolves from environment → collection → global scope; secrets use `{{$secret.key}}`.
4. **Add tests** — on the request *Tests* tab, e.g. `pm.test("status is 200", () => pm.response.to.have.status(200))`.
5. **Run a collection** — `apiplatform collection run "Products" --environment Local --reporter junit --report-file report.xml`.
6. **AI assistant** — click *AI* in the top bar, add a provider (any OpenAI-compatible endpoint), keys are stored in the encrypted vault and credentials are redacted before submission by default.

## Scripting API (sandbox)

Scripts run in a dedicated worker thread (so `while(true){}` cannot hang the
server) with CPU/time limits and **no filesystem or child-process access**.
Available: `pm.request`, `pm.response` (`.to.have.status(200)`, `.json()`,
`.text()`…), `pm.variables`, `pm.environment`, `pm.collectionVariables`,
`pm.globals`, `pm.cookies`, `pm.test`, `pm.expect` (Chai-like), `pm.sendRequest`,
`console.log/warn/error`.

## Tests

```bash
npm test            # unit + integration (shared + server)
npm run typecheck   # typecheck every package
npm run build       # build web, server and CLI
```

See [docs/TESTING.md](docs/TESTING.md) for details and known limitations.

## Security notes

- JWT auth; tenants isolated by workspace membership checks on every request
  (never trust workspace IDs from the client).
- Secrets stored AES-256-GCM encrypted (`VAULT_KEY`), never returned in list
  endpoints, never written to logs (structured logger + redaction helper).
- AI requests run through an aggressive credential redactor before leaving the
  client unless explicitly disabled; workspace admins can enforce allowed
  provider endpoints and regions.

See [docs/SECURITY.md](docs/SECURITY.md) for the full model and known limitations.

## License

MIT (see [LICENSE](./LICENSE)).
