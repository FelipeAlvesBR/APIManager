import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { ApiRequest, HeaderEntry, UrlQueryParam } from "@apiplatform/shared";
import { HTTP_METHODS } from "@apiplatform/shared";
import { useApp } from "../store";
import { api } from "../api";
import { KeyValueEditor } from "./KeyValueEditor";
import { BodyEditor } from "./BodyEditor";
import { AuthEditor } from "./AuthEditor";

const TABS = ["params", "headers", "body", "auth", "scripts", "tests", "code"] as const;
type Tab = (typeof TABS)[number];

export function RequestBuilder() {
  const activeRequest = useApp((s) => s.activeRequest);
  const sending = useApp((s) => s.sending);
  const updateActiveRequest = useApp((s) => s.updateActiveRequest);
  const saveRequest = useApp((s) => s.saveRequest);
  const send = useApp((s) => s.send);
  const collections = useApp((s) => s.collections);
  const toast = useApp((s) => s.toast);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const [tab, setTab] = useState<Tab>("params");
  const [codeLang, setCodeLang] = useState("curl");
  const [codeSnippet, setCodeSnippet] = useState<string | null>(null);

  const method = activeRequest?.method ?? "GET";

  const urlPreview = useMemo(() => {
    if (!activeRequest) return "";
    const query = (activeRequest.query ?? [])
      .filter((q) => q.enabled && q.key)
      .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value ?? "")}`)
      .join("&");
    const base = activeRequest.url ?? "";
    return query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base;
  }, [activeRequest]);

  if (!activeRequest) {
    return (
      <div className="center-panel" style={{ padding: 60 }}>
        <h2>Select a request or create a new one</h2>
        <p className="muted">Pick from the sidebar, or use <kbd>Ctrl/Cmd+N</kbd> to start fresh.</p>
        <button className="ds-btn primary" onClick={() => useApp.getState().newRequest()}>
          ＋ New request
        </button>
      </div>
    );
  }

  const req = activeRequest;
  const patch = (p: Partial<ApiRequest>) => updateActiveRequest(p);

  async function handleSaveAs() {
    if (!activeWorkspaceId) return;
    const name = window.prompt("Collection name", "New Collection");
    if (!name) return;
    const col = await api.createCollection(activeWorkspaceId, { name });
    await saveRequest({ ...req, collectionId: col.collection.id });
    await useApp.getState().loadCollections();
    toast("success", "Saved to new collection");
  }

  async function handleSaveToCollection() {
    if (!activeWorkspaceId) return;
    if (req.collectionId) {
      await saveRequest({ ...req });
      toast("success", "Saved");
      return;
    }
    const colName = window.prompt("Collection name", "My Collection");
    if (!colName) return;
    const col = await api.createCollection(activeWorkspaceId, { name: colName });
    await saveRequest({ ...req, collectionId: col.collection.id });
    await useApp.getState().loadCollections();
    toast("success", "Saved to collection");
  }

  async function generateCode() {
    if (!req || !activeWorkspaceId) return;
    const headers: Record<string, string> = {};
    for (const h of req.header ?? []) if (h.enabled && h.key) headers[h.key] = h.value;
    const res = await api.codegen(activeWorkspaceId, {
      method,
      url: urlPreview,
      headers,
      body: req.body?.raw ?? req.body?.json ?? null,
      language: codeLang,
    });
    setCodeSnippet(res.snippet);
  }

  const events = req.events ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Request header row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px" }}>
        <input
          style={{ width: 220 }}
          value={req.name ?? ""}
          onChange={(e) => patch({ name: e.target.value })}
          aria-label="Request name"
        />
        <button className="ds-btn sm" onClick={() => void saveRequest({ ...req })} disabled={sending}>
          Save
        </button>
        <select
          className="ds-btn sm"
          value={method}
          onChange={(e) => patch({ method: e.target.value })}
          aria-label="HTTP method"
          style={{ color: `var(--${methodColor(method)})`, fontWeight: 700, fontFamily: "var(--mono)" }}
        >
          {[...HTTP_METHODS, "TRACE", "CUSTOM"].map((m) => (
            <option key={m} value={m === "CUSTOM" ? "PURGE" : m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="ds-mono grow"
          style={{ flex: 1 }}
          value={req.url ?? ""}
          placeholder="https://api.example.com/path?query=1"
          onChange={(e) => patch({ url: e.target.value })}
          aria-label="Request URL"
        />
        <button className="ds-btn primary" onClick={() => void send()} disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {/* URL preview */}
      <div className="small muted" style={{ padding: "0 12px 6px", fontFamily: "var(--mono)" }}>
        {urlPreview || "Enter a URL above"}
      </div>

      <div className="ds-divider" />

      {/* Config tabs */}
      <div className="tabs" role="tablist" aria-label="Request configuration">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)} style={{ fontSize: 12, textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="grow scroll" style={{ padding: 10, minHeight: 120 }}>
        {tab === "params" && (
          <KeyValueEditor
            rows={(req.query ?? []) as never}
            onChange={(rows) => patch({ query: rows as UrlQueryParam[] })}
          />
        )}
        {tab === "headers" && (
          <KeyValueEditor rows={(req.header ?? []) as never} onChange={(rows) => patch({ header: rows as HeaderEntry[] })} />
        )}
        {tab === "body" && <BodyEditor body={req.body} onChange={(body) => patch({ body })} />}
        {tab === "auth" && <AuthEditor auth={req.auth} onChange={(auth) => patch({ auth })} />}
        {tab === "scripts" && <ScriptsEditor value={events.prerequest ?? ""} onChange={(v) => patch({ events: { ...events, prerequest: v } })} kind="Pre-request" />}
        {tab === "tests" && <ScriptsEditor value={events.test ?? ""} onChange={(v) => patch({ events: { ...events, test: v } })} kind="Post-response / tests" />}
        {tab === "code" && (
          <div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <select value={codeLang} onChange={(e) => setCodeLang(e.target.value)}>
                {["curl", "javascript", "node", "python", "java", "kotlin", "swift", "csharp", "go", "php", "ruby", "http"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button className="ds-btn sm" onClick={() => void generateCode()}>
                Generate
              </button>
              {codeSnippet && (
                <button className="ds-btn sm" onClick={() => void navigator.clipboard.writeText(codeSnippet)}>
                  Copy
                </button>
              )}
            </div>
            {codeSnippet && (
              <pre className="code-block" style={{ height: 300 }}>
                {codeSnippet}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Save actions */}
      <div style={{ display: "flex", gap: 6, padding: "6px 12px", borderTop: "1px solid var(--border)" }}>
        <button className="ds-btn sm" onClick={() => void handleSaveToCollection()}>
          Save to collection
        </button>
        <button className="ds-btn sm" onClick={() => void handleSaveAs()}>
          Save as new collection
        </button>
        {req.id && (
          <button
            className="ds-btn sm danger"
            onClick={async () => {
              if (!window.confirm("Delete this request?")) return;
              if (activeWorkspaceId) {
                await api.deleteRequest(activeWorkspaceId, req.id);
                useApp.setState({ activeRequest: null, response: null });
                await useApp.getState().loadCollections();
                await useApp.getState().loadRequests();
              }
            }}
          >
            Delete request
          </button>
        )}
        {collections.length > 0 && (
          <button
            className="ds-btn sm"
            onClick={async () => {
              const id = window.prompt("Collection id to move to (from sidebar)", req.collectionId ?? "");
              if (id) {
                await saveRequest({ ...req, collectionId: id });
              }
            }}
          >
            Move to collection…
          </button>
        )}
        <span className="grow" />
        {req.collectionId && (
          <span className="small muted">in {collections.find((c) => c.id === req.collectionId)?.name}</span>
        )}
      </div>
    </div>
  );
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "success";
    case "POST":
      return "warning";
    case "PUT":
    case "PATCH":
      return "info";
    case "DELETE":
      return "error";
    default:
      return "text-dim";
  }
}

function ScriptsEditor({ value, onChange, kind }: { value: string; onChange: (v: string) => void; kind: string }) {
  const [samples, setSamples] = useState<string | null>(null);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <strong>{kind} script</strong>
        <button className="ds-btn sm" onClick={() => setSamples(samples ? null : SAMPLE)}>
          {samples ? "Hide sample" : "Insert sample"}
        </button>
      </div>
      <div className="editor-wrap">
        <Editor
          height="260px"
          theme="vs-dark"
          language="javascript"
          value={samples ?? value}
          onChange={(v) => onChange(v ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 12 }}
        />
      </div>
      {samples && <div className="small muted">Inserted sample — edit to fit your API.</div>}
    </div>
  );
}

const SAMPLE = `// pm.* API is available (variables, request, response, sendRequest, expect)
pm.test("status is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("has id", function () {
  const json = pm.response.json();
  pm.expect(json.id).to.exist;
});

// Save a value for later requests
pm.variables.set("lastId", pm.response.json().id);
`;