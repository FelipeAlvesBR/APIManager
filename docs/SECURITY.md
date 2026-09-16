# Security

## Threat model highlights

- **Tenant isolation.** Workspace IDs are never trusted from the client.
  Every handler re-checks membership + role against the database before any
  read or write. Guessing a workspace ID yields `404` (non-members cannot
  confirm a workspace exists).
- **AuthN.** bcrypt(password) hashing; short-lived stateless JWTs carrying a
  token version. Every request re-validates the account is active and the
  token version matches, so password/token rotation immediately invalidates
  outstanding tokens.
- **Scripts.** User JavaScript runs in a worker thread inside a `node:vm`
  context. There is **no filesystem access, no `child_process`, no network**
  except the explicitly provided `pm.sendRequest`. CPU use is bounded by a
  timeout plus worker termination for hard loops. Scripts cannot read the
  server's environment, secrets, or other users' data.
- **Secrets vault.** AES-256-GCM encryption at rest with a key from
  `VAULT_KEY` (or derived from `JWT_SECRET` in dev). List endpoints return only
  keys. Reveal is a separate audited action requiring a user gesture.
- **Log hygiene.** The logger never receives raw secret values; a `redact()`
  helper masks authorization headers, API keys, JWTs and password-like fields.
  Request URLs are redacted before logging.
- **AI data boundary.** Before any chat message leaves the client, an
  aggressive heuristic redactor replaces API keys, bearer tokens, JWTs,
  passwords and cookie-like values with placeholders (toggleable). Admin policy
  can restrict provider base URLs and require a region. Provider keys live in
  the vault, and test/chat are blocked by policy when disallowed.
- **Transport.** TLS in production (terminate at a reverse proxy); secure
  cookies, strict CORS via `CORS_ORIGINS`.
- **Rate limiting.** In-memory per-IP limiter on auth endpoints.
- **Mock endpoints are public by design** (they emulate a live API). Keep mock
  IDs unguessable; workspace data is never exposed through them.

## Do not

- Never set `JWT_SECRET` to the default in production.
- Never commit `.env` files (git-ignored).
- Never paste a secret into a request URL/header you intend to share or export —
  secrets are redacted from AI context but exports of collections are raw data.

## Known limitations

- The secret vault uses a single application key (KMS rotation is future work).
- Rate limiting is per-process/in-memory; multi-instance deployments need a
  shared store (e.g. Redis).
- The AI agent in this MVP is conversational (chat) plus tool definitions in the
  provider client; full autonomous agent workflows and MCP server are planned
  but not shipped here. See `docs/TESTING.md` for the full limitation list.
- YAML import is supported via the `yaml` package; OpenAPI validation is
  structural (not a full JSON-Schema validator).