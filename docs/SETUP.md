# Setup, Deployment & Operations

## Requirements

- Node.js **>= 20.6** (uses the built-in `node:sqlite` module — **no native
  compilation, no external database required**)
- npm 9+

## Local development

```bash
git clone <this repo>
cd APIManager
cp .env.example .env
npm install
npm run db:migrate      # create/upgrade the SQLite schema
npm run seed            # create demo account + "Sample Commerce API" workspace
npm run dev             # runs API server (:4000) + web app (:5173) together
```

Open http://localhost:5173 and sign in with `demo@apiplatform.dev` /
`demo12345` (or register a new account).

Useful extras:

- `npm run dev:server` — API server only
- `npm run dev:web` — web app only
- `npm run build` — production build of web, server and CLI
- `npm run test` / `npm run typecheck` / `npm run lint`

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | API server port |
| `HOST` | `127.0.0.1` | Bind address |
| `NODE_ENV` | `development` | `production` enables JSON-only logs |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `APP_URL` | `http://localhost:4000` | Public base URL used in generated links |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `DATABASE_PATH` | `./data/apiplatform.db` | SQLite file (or `:memory:`) |
| `JWT_SECRET` | insecure dev default | **Change in production** (≥ 32 chars) |
| `JWT_TTL` | `24h` | Access token lifetime |
| `VAULT_KEY` | derived from `JWT_SECRET` | Base64 32-byte key for the secret vault |
| `AI_DEFAULT_PROVIDER` / `_BASE_URL` / `_API_KEY` / `_MODEL` | empty | Optional global default provider |
| `AI_REQUEST_TIMEOUT_MS` | `60000` | LLM request timeout |
| `AI_MAX_OUTPUT_TOKENS` | `2048` | Default max output tokens |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `300` | Per-IP rate limiting (auth routes) |
| `REQUEST_EXECUTION_TIMEOUT_MS` | `30000` | Default request execution timeout |
| `SCRIPT_TIMEOUT_MS` | `3000` | Script execution limit |
| `MAX_REDIRECTS` | `10` | Redirect loop cap |
| `MAX_RESPONSE_CAPTURE_BYTES` | `2097152` | Max captured response body |

Generate a vault key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Production build & run

```bash
npm install
npm run build
npm run db:migrate
# server (compiled output):
npm run start -w @apiplatform/server
# serve the web build with any static host (e.g. nginx) pointing at packages/web/dist
# or during development use `npm run dev:web`.
```

For real deployments run the server behind a TLS-terminating reverse proxy and
set `CORS_ORIGINS` to your app origin.

## CLI

```bash
npm run build -w @apiplatform/cli
npm link            # optional — exposes `apiplatform` globally
apiplatform login -u http://your-server:4000
apiplatform collection run "Products" --environment Local --reporter junit --report-file report.xml
```

The CLI stores credentials in `~/.apiplatform/config.json`.

## Backup & recovery

The entire application state lives in the SQLite file at `DATABASE_PATH`
(plus its `-wal`/`-shm` sidecars). To back up:

- Stop the server, or use the SQLite online backup API (Node exposes it via
  `node:sqlite`'s `backup`), then copy the file.
- Restore by replacing the file and restarting the server; migrations are
  idempotent and will re-run harmlessly.

Recommended cadence: full file snapshot + a nightly copy of `audit_events` if
you need long-term compliance history. `data/` is git-ignored.

## Monitors scheduler

The server runs an in-process scheduler that ticks every 60 seconds, runs any
enabled monitor whose schedule is due, and records `monitor_runs`. Schedules
supported: `1min`, `5min`, `15min`, `hourly`, `daily`, `weekly`,
`every-N-minutes`, or `cron:...` (treated as 5-minute polling for MVP).