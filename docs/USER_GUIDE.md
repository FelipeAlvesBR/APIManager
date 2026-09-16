# User Guide

## Getting started

Sign in (or register). Every new account gets a personal workspace. A demo
workspace **"Sample Commerce API"** is seeded and includes everything you need
to explore: collections, environments, tests, a mock server, an OpenAPI spec
and a monitor.

## The workspace

- **Top bar** — workspace selector, environment selector, command palette
  (`Ctrl/Cmd+K`), workspace creation, AI assistant, account/sign-out.
- **Left sidebar** — three tabs: *Collections* (tree with folders/requests),
  *History* (recent sends, click to replay), *Environments* (plus globals and
  the secrets vault).
- **Center** — request builder on top, response viewer below.

## Sending a request

1. `Ctrl/Cmd+K` → **New request** (or the ＋ button in the sidebar).
2. Pick a method, enter a URL. Use the *params* tab to add query parameters
   (the resolved URL preview updates live).
3. Add headers, a body (text / JSON / XML / JS / HTML / form-data /
   urlencoded / binary / GraphQL) and authorization in the corresponding tabs.
4. Press **Send** (`Ctrl/Cmd+Enter`).

The response pane shows status, duration, size, and tabs for pretty JSON,
raw body, headers/cookies, test results and script console output. **Save as
example** stores a response for reuse (and for mock servers).

## Variables & environments

- References use `{{variableName}}`. Precedence:
  `runtime > data > environment > collection > global > system/dynamic`.
- Create environments (e.g. Local / Staging / Production) and switch them from
  the top bar; `{{baseUrl}}` style variables make switching trivial.
- Dynamic variables: `{{$guid}}`, `{{$randomEmail}}`, `{{$timestamp}}`, etc.
- **Secrets vault**: store values in the *Environments* → *Secrets vault* tab.
  They are encrypted at rest, never listed, and referenced with
  `{{$secret.key}}`. Reveal requires an explicit click.

## Scripts & tests

On the request's **Scripts** (pre-request) and **Tests** (post-response) tabs:

```javascript
// Pre-request: compute a signature or set variables
pm.variables.set("token", "generated-" + Date.now());

// Tests: assert on the response
pm.test("status is 200", function () {
  pm.response.to.have.status(200);
});
pm.test("has id", function () {
  const json = pm.response.json();
  pm.expect(json.id).to.exist;
  pm.variables.set("lastId", json.id); // feed the next request
});
```

`pm.expect` supports `.equal/.eql/.include/.property/.length/.match/.above/
.below/.an/.oneOf` and negation via `.not`. `pm.sendRequest(url, cb)` lets
tests call other endpoints.

## Collections & the runner

Save requests into collections (the *Save to collection* button creates one on
the fly). The runner is available through the API and the CLI:

```bash
apiplatform collection run "Products" --environment Local \
  --iterations 3 --data ./users.json --stop-on-failure \
  --reporter junit --report-file report.xml
```

## Mocks & monitors

- **Mocks** are created from a collection's saved examples (or directly with
  routes). Each mock is served at `https://<your-server>/mock/<mockId>/<path>`.
- **Monitors** run a collection on a schedule and record pass/fail history;
  they can be triggered on demand.

## Import / export / code

- Import a **cURL** command, a **Postman Collection**, or an **OpenAPI** spec
  from the sidebar (⇪ button).
- Export a collection to Postman JSON via the API or CLI.
- Generate client snippets in 12 languages from the request *code* tab.

## AI assistant (bring your own model)

Click **AI** in the top bar. Add a provider — any **OpenAI-compatible**
endpoint:

- **Base URL**: e.g. `https://gateway.company.example/v1` (or
  `http://localhost:11434` for Ollama).
- **Model**, optional **API key** (stored in the encrypted vault).
- **Test** runs a 7-step health check (connectivity, TLS, auth, model call,
  tool-call support, streaming, latency).

Credentials are **redacted from prompts by default** (toggle *Redact
credentials*). Workspace admins can enforce allowed base URLs and regions under
the AI policy API. A provider outage never affects the rest of the platform.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + K | Command palette |
| Ctrl/Cmd + Enter | Send request |
| Ctrl/Cmd + S | Save |
| Ctrl/Cmd + Shift + S | Save as |
| Ctrl/Cmd + Shift + N | New request |
| Esc | Close modal |

---

# Administrator Guide

## Roles

| Role | Capabilities |
| --- | --- |
| Owner | everything, including deleting the workspace and removing anyone |
| Admin | member management, workspace settings, AI policy, audit log |
| Editor | create/edit/delete collections, requests, environments, mocks, monitors, runs |
| Commenter | view + comment |
| Viewer | view only |

Members are added by email (the account must already exist). Role changes take
effect immediately because permissions are read from the database on every
request.

## AI policy (admin)

Under `PUT /api/ai/:workspaceId/policy` you can set:

- `allowedBaseUrls` — only approved provider endpoints are usable;
- `requireRegion` — reject providers not in a required region;
- `blockSecrets` — force redaction for all AI requests.

## Audit

Every mutation writes an `audit_events` row (action, actor, resource, details,
timestamp). Workspace admins can read them via
`GET /api/workspaces/:workspaceId/audit`.

## Operations

See `docs/SETUP.md` for backup/recovery, environment variables and production
deployment.