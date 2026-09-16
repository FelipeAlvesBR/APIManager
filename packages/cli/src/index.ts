#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";

function classifyStatus(code: number): string {
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "redirect";
  if (code >= 400 && code < 500) return "clientError";
  if (code >= 500) return "serverError";
  return "none";
}

// ---------------- config ----------------

interface CliConfig {
  baseUrl: string;
  token?: string;
  defaultWorkspace?: string;
}

function configDir(): string {
  return path.join(os.homedir(), ".apiplatform");
}

function configPath(): string {
  return path.join(configDir(), "config.json");
}

function loadConfig(): CliConfig {
  try {
    const raw = readFileSync(configPath(), "utf8");
    return { baseUrl: "http://127.0.0.1:4000", ...JSON.parse(raw) };
  } catch {
    return { baseUrl: "http://127.0.0.1:4000" };
  }
}

function saveConfig(cfg: CliConfig): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

// ---------------- api client ----------------

async function api<T>(method: string, path_: string, body?: unknown, token?: string): Promise<T> {
  const cfg = loadConfig();
  const url = `${cfg.baseUrl}${path_}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token || cfg.token ? { Authorization: `Bearer ${token ?? cfg.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    fail(`Network error calling ${url}: ${(err as Error).message}`, 3);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 401) fail("Not authorized. Run `apiplatform login` first.", 4);
  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    fail(message, data?.error?.code === "NOT_FOUND" ? 2 : 3);
  }
  return data as T;
}

function fail(message: string, code: number): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function requireToken(): string {
  const cfg = loadConfig();
  if (!cfg.token) fail("Not logged in. Run `apiplatform login`.", 4);
  return cfg.token!;
}

// ---------------- reporters ----------------

interface ReportItem {
  name: string;
  method: string;
  url: string;
  status: number | null;
  duration: number;
  passed: number;
  failed: number;
  total: number;
  error?: string;
}

function cliReporter(items: ReportItem[]): void {
  for (const it of items) {
    const status = it.status === null ? "ERR" : String(it.status);
    const cls = it.status === null ? "\x1b[31m" : classifyStatus(it.status) === "success" ? "\x1b[32m" : classifyStatus(it.status) === "clientError" ? "\x1b[33m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const verdict = it.failed > 0 || it.error ? "FAIL" : it.total > 0 ? "PASS" : "     ";
    console.log(
      `${cls}${verdict}${reset} ${it.method.padEnd(6)} ${it.name} ${status} ${it.duration}ms` +
        (it.failed > 0 ? ` (${it.failed} assertion(s) failed)` : "") +
        (it.error ? ` — ${it.error}` : ""),
    );
  }
}

function junitReporter(items: ReportItem[], outPath?: string): void {
  const cases = items
    .map(
      (it) =>
        `  <testcase classname="${esc(it.name)}" name="${esc(it.name)}" time="${(it.duration / 1000).toFixed(3)}">${
          it.failed > 0 || it.error ? `<failure message="${esc(it.error ?? `${it.failed} assertions failed`)}"/>` : ""
        }</testcase>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${items.length}" failures="${items.filter((i) => i.failed > 0 || i.error).length}">\n  <testsuite tests="${items.length}" failures="${items.filter((i) => i.failed > 0 || i.error).length}">\n${cases}\n  </testsuite>\n</testsuites>\n`;
  output(xml, outPath);
}

function htmlReporter(items: ReportItem[], outPath?: string): void {
  const rows = items
    .map(
      (it) =>
        `<tr><td>${it.method}</td><td>${esc(it.name)}</td><td>${it.status ?? "ERR"}</td><td>${it.duration}ms</td><td>${it.passed}/${it.total}</td><td>${it.failed > 0 || it.error ? "FAIL" : "PASS"}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>API Platform Run Report</title><style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left}</style></head><body><h1>Run Report</h1><table><thead><tr><th>Method</th><th>Name</th><th>Status</th><th>Duration</th><th>Assertions</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`;
  output(html, outPath);
}

function output(content: string, outPath?: string): void {
  if (outPath) {
    mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    writeFileSync(outPath, content);
    console.log(`Report written to ${outPath}`);
  } else {
    process.stdout.write(content);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------- helpers ----------------

async function resolveWorkspace(token: string, name?: string): Promise<string> {
  const data = await api<{ workspaces: { id: string; name: string }[] }>("GET", "/api/workspaces", undefined, token);
  if (name) {
    const found = data.workspaces.find((w) => w.name === name);
    if (found) return found.id;
    fail(`Workspace "${name}" not found`, 2);
  }
  if (!data.workspaces.length) fail("No workspaces found", 2);
  return data.workspaces[0]!.id;
}

async function resolveEnvironment(token: string, ws: string, name?: string): Promise<string | undefined> {
  if (!name) return undefined;
  const data = await api<{ environments: { id: string; name: string }[] }>("GET", `/api/environments/${ws}`, undefined, token);
  const found = data.environments.find((e) => e.name === name || e.id === name);
  if (!found) fail(`Environment "${name}" not found`, 2);
  return found.id;
}

// ---------------- program ----------------

const program = new Command();
program.name("apiplatform").description("API Platform CLI — run collections, validate specs, export/import").version("0.1.0");

program
  .command("login")
  .description("Log in and store the session token")
  .option("-e, --email <email>", "email")
  .option("-p, --password <password>", "password")
  .option("-u, --base-url <url>", "API base URL", "http://127.0.0.1:4000")
  .option("-t, --token <token>", "API token (alternative to email/password)")
  .action(async (opts: { email?: string; password?: string; baseUrl: string; token?: string }) => {
    let token = opts.token;
    if (!token) {
      if (!opts.email || !opts.password) {
        fail("Provide --email/--password or --token", 2);
      }
      // Login against the explicitly supplied base URL (before config is saved).
      let res: Response;
      try {
        res = await fetch(`${opts.baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: opts.email, password: opts.password }),
        });
      } catch (err) {
        fail(`Network error calling ${opts.baseUrl}/api/auth/login: ${(err as Error).message}`, 3);
      }
      if (res.status === 401) fail("Invalid email or password", 4);
      if (!res.ok) fail(`Login failed (HTTP ${res.status})`, 3);
      const data = (await res.json()) as { token: string };
      token = data.token;
    }
    const cfg = loadConfig();
    cfg.baseUrl = opts.baseUrl;
    cfg.token = token;
    saveConfig(cfg);
    console.log("Logged in. Token stored in", configPath());
  });

program.command("logout").description("Remove stored session").action(() => {
  const cfg = loadConfig();
  cfg.token = undefined;
  saveConfig(cfg);
  console.log("Logged out.");
});

program.command("whoami").description("Show the current account").action(async () => {
  const token = requireToken();
  const data = await api<{ user: { email: string; name: string } }>("GET", "/api/auth/me", undefined, token);
  console.log(`${data.user.name} <${data.user.email}>`);
});

const workspaceCmd = program.command("workspace").description("Workspace commands");
workspaceCmd
  .command("list")
  .description("List workspaces")
  .action(async () => {
    const token = requireToken();
    const data = await api<{ workspaces: { id: string; name: string; visibility: string }[] }>("GET", "/api/workspaces", undefined, token);
    for (const w of data.workspaces) console.log(`${w.id}\t${w.name}\t${w.visibility}`);
  });

const collectionCmd = program.command("collection").description("Collection commands");
collectionCmd
  .command("list")
  .description("List collections in a workspace")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const data = await api<{ collections: { id: string; name: string }[] }>("GET", `/api/collections/${ws}`, undefined, token);
    for (const c of data.collections) console.log(`${c.id}\t${c.name}`);
  });

collectionCmd
  .command("run")
  .description("Run a collection and report results")
  .argument("<collection>", "collection id or name")
  .option("-w, --workspace <name>", "workspace name or id")
  .option("-e, --environment <name>", "environment name or id")
  .option("-i, --iterations <n>", "iterations", "1")
  .option("--delay <ms>", "delay between requests", "0")
  .option("--data <file>", "JSON data file for data-driven runs")
  .option("--stop-on-failure", "stop the run on first failure")
  .option("-r, --reporter <name>", "reporter: cli|json|junit|html", "cli")
  .option("--report-file <file>", "write report to file")
  .action(async (collection: string, opts: { workspace?: string; environment?: string; iterations: string; delay: string; data?: string; stopOnFailure?: boolean; reporter: string; reportFile?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const envId = await resolveEnvironment(token, ws, opts.environment);
    let collectionId = collection;
    if (!collection.startsWith("col_")) {
      const list = await api<{ collections: { id: string; name: string }[] }>("GET", `/api/collections/${ws}`, undefined, token);
      const found = list.collections.find((c) => c.name === collection);
      if (!found) fail(`Collection "${collection}" not found`, 2);
      collectionId = found.id;
    }
    let data;
    if (opts.data) {
      try {
        data = JSON.parse(readFileSync(opts.data, "utf8"));
      } catch {
        fail(`Could not read data file ${opts.data}`, 2);
      }
    }
    const report = await api<{ id: string; summary: { total: number; passed: number; failed: number; duration: number }; items: ReportItem[] }>("POST", `/api/runs/${ws}`, {
      collectionId,
      environmentId: envId,
      iterations: Number(opts.iterations) || 1,
      delayMs: Number(opts.delay) || 0,
      data,
      stopOnFailure: Boolean(opts.stopOnFailure),
    });
    const summary = report.summary;
    switch (opts.reporter) {
      case "json":
        output(JSON.stringify(report, null, 2), opts.reportFile);
        break;
      case "junit":
        junitReporter(report.items, opts.reportFile);
        break;
      case "html":
        htmlReporter(report.items, opts.reportFile);
        break;
      default:
        cliReporter(report.items);
        console.log(`\nTotal: ${summary.total}  Passed: ${summary.passed}  Failed: ${summary.failed}  Duration: ${summary.duration}ms`);
    }
    process.exit(summary.failed > 0 ? 1 : 0);
  });

program
  .command("request run")
  .description("Run a single request")
  .argument("<requestId>", "request id")
  .option("-w, --workspace <name>", "workspace name or id")
  .option("-e, --environment <name>", "environment name or id")
  .option("--json", "output JSON response", false)
  .action(async (requestId: string, opts: { workspace?: string; environment?: string; json?: boolean }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const envId = await resolveEnvironment(token, ws, opts.environment);
    const data = await api<{ response: { status: number | null; durationMs: number; body: string; tests: { name: string; passed: boolean }[] }; tests: unknown[] }>(
      "POST",
      `/api/requests/${ws}/${requestId}/send`,
      { environmentId: envId, runtime: {} },
      token,
    );
    const r = data.response;
    if (opts.json) {
      output(JSON.stringify(r, null, 2));
    } else {
      console.log(`${r.status}  ${r.durationMs}ms`);
      if (r.body) process.stdout.write(r.body.slice(0, 4000) + "\n");
      const failed = r.tests.filter((t) => !t.passed);
      if (failed.length) fail(`${failed.length} assertion(s) failed`, 1);
    }
  });

program
  .command("monitor run")
  .description("Trigger a monitor run")
  .argument("<monitorId>", "monitor id")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (monitorId: string, opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const data = await api<{ passed: boolean; summary: { failed: number; total: number } }>("POST", `/api/monitors/${ws}/${monitorId}/run`, {}, token);
    console.log(data.passed ? "Monitor passed" : "Monitor FAILED", `(${data.summary.failed}/${data.summary.total} failing)`);
    process.exit(data.passed ? 0 : 1);
  });

const specCmd = program.command("spec").description("Specification commands");
specCmd
  .command("validate")
  .description("Validate an OpenAPI specification")
  .argument("<file>", "path to spec (JSON or YAML)")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (file: string, opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const content = readFileSync(file, "utf8");
    const format = file.endsWith(".yaml") || file.endsWith(".yml") ? "openapi-yaml" : "openapi-json";
    const result = await api<{ valid: boolean; issues: { severity: string; message: string; path: string }[]; summary: { paths: number; operations: number } }>(
      "POST",
      `/api/specs/${ws}/validate`,
      { content, format },
      token,
    );
    for (const issue of result.issues) console.log(`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`);
    console.log(`\nValid: ${result.valid}  Paths: ${result.summary.paths}  Operations: ${result.summary.operations}`);
    process.exit(result.valid ? 0 : 2);
  });

specCmd
  .command("generate")
  .description("Generate a collection from an OpenAPI spec")
  .argument("<file>", "path to spec")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (file: string, opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const content = readFileSync(file, "utf8");
    const type = file.endsWith(".yaml") || file.endsWith(".yml") ? "openapi-yaml" : "openapi-json";
    const result = await api<{ requests: unknown[] }>("POST", `/api/import/${ws}`, { type, content }, token);
    console.log(`Generated ${result.requests.length} request(s) from ${file}`);
  });

collectionCmd
  .command("export")
  .description("Export a collection to Postman JSON")
  .argument("<collectionId>", "collection id")
  .argument("<file>", "output file")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (collectionId: string, file: string, opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const cfg = loadConfig();
    const res = await fetch(`${cfg.baseUrl}/api/export/${ws}/${collectionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) fail(`Export failed (HTTP ${res.status})`, 3);
    const text = await res.text();
    writeFileSync(file, text);
    console.log(`Exported to ${file}`);
  });

collectionCmd
  .command("import")
  .description("Import a collection from a Postman JSON or OpenAPI file")
  .argument("<file>", "input file")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (file: string, opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const content = readFileSync(file, "utf8");
    const type = file.endsWith(".yaml") || file.endsWith(".yml") ? "openapi-yaml" : file.endsWith(".json") && (content.includes('"openapi"') || content.includes("openapi:")) ? "openapi-json" : "postman";
    const result = await api<{ requests: unknown[] }>("POST", `/api/import/${ws}`, { type, content }, token);
    console.log(`Imported ${result.requests.length} request(s)`);
  });

const envCmd = program.command("environment").description("Environment commands");
envCmd
  .command("list")
  .description("List environments in a workspace")
  .option("-w, --workspace <name>", "workspace name or id")
  .action(async (opts: { workspace?: string }) => {
    const token = requireToken();
    const ws = await resolveWorkspace(token, opts.workspace);
    const data = await api<{ environments: { id: string; name: string }[] }>("GET", `/api/environments/${ws}`, undefined, token);
    for (const e of data.environments) console.log(`${e.id}\t${e.name}`);
  });

program.parseAsync(process.argv).catch((err) => {
  fail(err instanceof Error ? err.message : String(err), 5);
});

export { loadConfig, saveConfig };