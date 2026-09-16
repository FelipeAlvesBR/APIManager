import Editor from "@monaco-editor/react";
import type { BodyMode, RequestBody, FormField, KeyValue } from "@apiplatform/shared";

const BODY_MODES: { value: BodyMode; label: string }[] = [
  { value: "none", label: "none" },
  { value: "raw", label: "text" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "javascript", label: "JavaScript" },
  { value: "html", label: "HTML" },
  { value: "formdata", label: "form-data" },
  { value: "urlencoded", label: "x-www-form-urlencoded" },
  { value: "binary", label: "binary" },
  { value: "graphql", label: "GraphQL" },
];

function languageFor(mode: BodyMode): string {
  if (mode === "json") return "json";
  if (mode === "xml") return "xml";
  if (mode === "javascript") return "javascript";
  if (mode === "html") return "html";
  if (mode === "graphql") return "graphql";
  return "plaintext";
}

export function BodyEditor({
  body,
  onChange,
}: {
  body: RequestBody | undefined;
  onChange: (body: RequestBody) => void;
}) {
  const mode: BodyMode = body?.mode ?? "none";
  const setMode = (m: BodyMode) => {
    if (m === "none") onChange({ mode: "none" });
    else if (m === "raw" || m === "xml" || m === "javascript" || m === "html") onChange({ mode: m, raw: body?.raw ?? "" });
    else if (m === "json") onChange({ mode: m, json: body?.json ?? "{\n  \n}" });
    else if (m === "urlencoded") onChange({ mode: m, urlencoded: body?.urlencoded ?? [] });
    else if (m === "formdata") onChange({ mode: m, formdata: body?.formdata ?? [] });
    else if (m === "binary") onChange({ mode: m, binary: body?.binary ?? "" });
    else if (m === "graphql") onChange({ mode: m, graphql: body?.graphql ?? { query: "" } });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {BODY_MODES.map((m) => (
          <button key={m.value} className={"ds-btn sm" + (mode === m.value ? " primary" : "")} onClick={() => setMode(m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "none" && <div className="center-panel small">This request has no body.</div>}

      {(mode === "raw" || mode === "xml" || mode === "javascript" || mode === "html") && (
        <div className="editor-wrap">
          <Editor
            height="260px"
            theme="vs-dark"
            defaultLanguage={languageFor(mode)}
            value={body?.raw ?? ""}
            onChange={(v) => onChange({ mode, raw: v ?? "" })}
            options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: "on" }}
          />
        </div>
      )}

      {mode === "json" && (
        <div className="editor-wrap">
          <Editor
            height="260px"
            theme="vs-dark"
            language="json"
            value={body?.json ?? ""}
            onChange={(v) => onChange({ mode: "json", json: v ?? "" })}
            options={{ minimap: { enabled: false }, fontSize: 12, formatOnPaste: true, lineNumbers: "on" }}
          />
        </div>
      )}

      {mode === "urlencoded" && <KvRows rows={body?.urlencoded ?? []} onChange={(rows) => onChange({ mode, urlencoded: rows })} />}

      {mode === "formdata" && <FormRows rows={body?.formdata ?? []} onChange={(rows) => onChange({ mode, formdata: rows })} />}

      {mode === "binary" && (
        <div>
          <textarea
            className="ds-mono"
            style={{ width: "100%", height: 120 }}
            placeholder="base64-encoded bytes"
            value={body?.binary ?? ""}
            onChange={(e) => onChange({ mode, binary: e.target.value })}
          />
          <div className="small muted">Paste base64 bytes (or a data: URL).</div>
        </div>
      )}

      {mode === "graphql" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="editor-wrap">
            <Editor
              height="180px"
              theme="vs-dark"
              language="graphql"
              value={body?.graphql?.query ?? ""}
              onChange={(v) => onChange({ mode, graphql: { query: v ?? "", variables: body?.graphql?.variables } })}
              options={{ minimap: { enabled: false }, fontSize: 12 }}
            />
          </div>
          <div className="editor-wrap">
            <Editor
              height="100px"
              theme="vs-dark"
              language="json"
              value={body?.graphql?.variables ?? ""}
              onChange={(v) => onChange({ mode, graphql: { query: body?.graphql?.query ?? "", variables: v ?? "" } })}
              options={{ minimap: { enabled: false }, fontSize: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function KvRows({ rows, onChange }: { rows: KeyValue[]; onChange: (rows: KeyValue[]) => void }) {
  return (
    <table className="kv-table">
      <thead>
        <tr>
          <th style={{ width: 30 }}></th>
          <th>Key</th>
          <th>Value</th>
          <th style={{ width: 36 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <input type="checkbox" checked={r.enabled} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} />
            </td>
            <td>
              <input value={r.key} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            </td>
            <td>
              <input value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </td>
            <td>
              <button className="ds-btn ghost icon sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormRows({ rows, onChange }: { rows: FormField[]; onChange: (rows: FormField[]) => void }) {
  return (
    <table className="kv-table">
      <thead>
        <tr>
          <th style={{ width: 30 }}></th>
          <th style={{ width: 70 }}>Type</th>
          <th>Key</th>
          <th>Value</th>
          <th style={{ width: 36 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <input type="checkbox" checked={r.enabled} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} />
            </td>
            <td>
              <select value={r.type ?? "text"} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, type: e.target.value as "text" | "file" } : x)))}>
                <option value="text">text</option>
                <option value="file">file</option>
              </select>
            </td>
            <td>
              <input value={r.key} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            </td>
            <td>
              <input
                value={r.value}
                placeholder={r.type === "file" ? "base64 content" : "value"}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
            </td>
            <td>
              <button className="ds-btn ghost icon sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}