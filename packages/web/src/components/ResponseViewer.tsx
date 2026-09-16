import { useMemo, useState } from "react";
import { classifyStatus } from "@apiplatform/shared";
import { useApp } from "../store";

type ViewMode = "pretty" | "raw" | "headers" | "tests" | "console";

export function ResponseViewer() {
  const response = useApp((s) => s.response);
  const sending = useApp((s) => s.sending);
  const [mode, setMode] = useState<ViewMode>("pretty");

  const statusClass = useMemo(() => {
    if (!response?.status) return "";
    const cls = classifyStatus(response.status);
    return cls === "success" ? "status-2" : cls === "redirect" ? "status-3" : cls === "clientError" ? "status-4" : cls === "serverError" ? "status-5" : "";
  }, [response]);

  if (sending) {
    return (
      <div className="center-panel" style={{ padding: 40 }}>
        Sending request…
      </div>
    );
  }

  if (!response) {
    return (
      <div className="center-panel" style={{ padding: 40 }}>
        <h3 style={{ margin: 0 }}>No response yet</h3>
        <p className="muted small">Press <kbd>Ctrl/Cmd+Enter</kbd> or click Send.</p>
      </div>
    );
  }

  const tests = response.tests ?? [];
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.length - passed;
  const logs = response.logs ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      {/* Status bar */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "6px 12px", borderBottom: "1px solid var(--border)" }}>
        {response.error ? (
          <span className="status-5">{response.error.code}</span>
        ) : (
          <span className={statusClass}>
            {response.status} {response.statusText}
          </span>
        )}
        <span className="small muted">{response.durationMs} ms</span>
        <span className="small muted">{fmtBytes(response.sizeBytes)}</span>
        {response.remoteAddress && <span className="small muted">{response.remoteAddress}</span>}
        {tests.length > 0 && (
          <span className="small">
            <span style={{ color: "var(--success)" }}>{passed} passed</span>
            {failed > 0 && <span style={{ color: "var(--error)" }}> · {failed} failed</span>}
          </span>
        )}
        <span className="grow" />
        {!response.error && response.status !== null && <SaveExampleButton />}
      </div>

      {/* Mode tabs */}
      <div className="tabs">
        {(["pretty", "raw", "headers", "tests", "console"] as ViewMode[]).map((m) => (
          <button key={m} className={"tab" + (mode === m ? " active" : "")} onClick={() => setMode(m)} style={{ fontSize: 12, textTransform: "capitalize" }}>
            {m}
          </button>
        ))}
      </div>

      <div className="grow scroll">
        {mode === "pretty" && !response.error && <PrettyView body={response.body} />}
        {mode === "raw" && !response.error && (
          <pre className="response-body">{response.body}</pre>
        )}
        {mode === "headers" && !response.error && <HeadersView headers={response.headers} cookies={response.cookies} />}
        {mode === "tests" && <TestsView tests={tests} />}
        {mode === "console" && <ConsoleView logs={logs} />}
        {response.error && (
          <pre className="response-body" style={{ color: "var(--error)" }}>
            {response.error.code}: {response.error.message}
          </pre>
        )}
      </div>
    </div>
  );
}

function PrettyView({ body }: { body: string }) {
  const { kind, json } = useMemo(() => {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === "object" && parsed !== null) return { kind: "json", json: parsed } as const;
    } catch {
      /* not json */
    }
    if (/^\s*</.test(body)) return { kind: "html" } as const;
    if (/^data:image/.test(body) || body.startsWith("\u0089PNG")) return { kind: "image" } as const;
    return { kind: "text" } as const;
  }, [body]);

  if (kind === "json") return <JsonTree data={json} />;
  if (kind === "html")
    return (
      <iframe
        sandbox=""
        title="HTML preview"
        style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
        srcDoc={body}
      />
    );
  if (kind === "image")
    return (
      <div style={{ padding: 20 }}>
        <img src={body} alt="response" style={{ maxWidth: "100%" }} />
      </div>
    );
  return <pre className="response-body">{body}</pre>;
}

function JsonTree({ data }: { data: unknown }) {
  return (
    <div className="json-tree" style={{ padding: 10 }}>
      {renderNode(data, 0)}
    </div>
  );
}

function renderNode(value: unknown, depth: number): React.ReactNode {
  const indent = { paddingLeft: depth * 14 };
  if (value === null) return <span className="b">null</span>;
  if (typeof value === "boolean") return <span className="b">{String(value)}</span>;
  if (typeof value === "number") return <span className="n">{String(value)}</span>;
  if (typeof value === "string")
    return (
      <span className="s">
        "{value.replace(/"/g, '\\"')}"
      </span>
    );
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[ ]</span>;
    return (
      <div style={indent}>
        <span>[</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: 14 }}>
            {renderNode(item, depth + 1)}
            {i < value.length - 1 ? "," : ""}
          </div>
        ))}
        <span>]</span>
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{ }"}</span>;
    return (
      <div style={indent}>
        <span>{"{"}</span>
        {entries.map(([k, v], i) => (
          <div key={k} style={{ paddingLeft: 14 }}>
            <span className="k">"{k}"</span>: {renderNode(v, depth + 1)}
            {i < entries.length - 1 ? "," : ""}
          </div>
        ))}
        <span>{"}"}</span>
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function HeadersView({ headers, cookies }: { headers: Record<string, string>; cookies: Record<string, string> }) {
  return (
    <div style={{ padding: 10 }}>
      {Object.entries(headers).map(([k, v]) => (
        <div key={k} className="small" style={{ marginBottom: 3 }}>
          <span className="ds-mono" style={{ color: "var(--text-dim)" }}>{k}:</span>{" "}
          <span className="ds-mono">{v}</span>
        </div>
      ))}
      {Object.keys(cookies).length > 0 && (
        <>
          <div style={{ marginTop: 8 }} className="small muted">
            Cookies
          </div>
          {Object.entries(cookies).map(([k, v]) => (
            <div key={k} className="small ds-mono">
              {k}={v}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function TestsView({ tests }: { tests: { name: string; passed: boolean; message?: string }[] }) {
  if (tests.length === 0)
    return <div className="center-panel small">No tests ran for this request. Add a test script to the Tests tab.</div>;
  return (
    <div style={{ padding: 10 }}>
      {tests.map((t, i) => (
        <div key={i} className="small" style={{ marginBottom: 6, display: "flex", gap: 6 }}>
          <span style={{ color: t.passed ? "var(--success)" : "var(--error)" }}>{t.passed ? "✓" : "✕"}</span>
          <span className="grow">{t.name}</span>
          {t.message && <span className="muted">{t.message}</span>}
        </div>
      ))}
    </div>
  );
}

function ConsoleView({ logs }: { logs: { level: string; message: string }[] }) {
  if (logs.length === 0) return <div className="center-panel small">No console output.</div>;
  return (
    <div style={{ padding: 10 }}>
      {logs.map((l, i) => (
        <div key={i} className="small ds-mono" style={{ marginBottom: 2, color: l.level === "error" ? "var(--error)" : l.level === "warn" ? "var(--warning)" : "inherit" }}>
          {l.level}: {l.message}
        </div>
      ))}
    </div>
  );
}

function SaveExampleButton() {
  const activeRequest = useApp((s) => s.activeRequest);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const response = useApp((s) => s.response);
  const toast = useApp((s) => s.toast);
  return (
    <button
      className="ds-btn sm"
      onClick={async () => {
        if (!activeRequest?.id || !activeWorkspaceId || !response) return;
        await apiSaveExample(activeWorkspaceId, activeRequest.id, response);
        toast("success", "Saved as example");
      }}
    >
      Save as example
    </button>
  );
}

async function apiSaveExample(ws: string, requestId: string, response: { status: number | null; statusText: string; headers: Record<string, string>; body: string }) {
  const res = await fetch(`/api/examples/${ws}/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeadersLocal() },
    body: JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
    }),
  });
  if (!res.ok) throw new Error("Failed to save example");
}

function authHeadersLocal(): Record<string, string> {
  const token = localStorage.getItem("apiplatform.token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}