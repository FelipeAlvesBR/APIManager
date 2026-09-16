import type { AuthConfig, AuthType } from "@apiplatform/shared";

const AUTH_TYPES = ["none", "apikey", "bearer", "basic", "digest", "oauth2", "awsv4", "custom"];

export function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthConfig | null | undefined;
  onChange: (auth: AuthConfig | null) => void;
}) {
  const type = auth?.type ?? "none";
  const setType = (t: string) => {
    if (t === "none") onChange(null);
    else onChange({ type: t as AuthType });
  };
  const field = (key: string) => (auth as Record<string, unknown>)?.[key] ?? "";
  const set = (key: string, value: string) => {
    const next = { ...(auth as Record<string, unknown>), type, [key]: value };
    onChange(next as AuthConfig);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {AUTH_TYPES.map((t) => (
          <button key={t} className={"ds-btn sm" + (type === t ? " primary" : "")} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>

      {type === "apikey" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Key</label>
          <input value={String(field("key"))} onChange={(e) => set("key", e.target.value)} />
          <label className="small muted">Value</label>
          <input value={String(field("value"))} onChange={(e) => set("value", e.target.value)} />
          <label className="small muted">In</label>
          <select value={String(field("in") ?? "header")} onChange={(e) => set("in", e.target.value)}>
            <option value="header">Header</option>
            <option value="query">Query param</option>
          </select>
        </div>
      )}
      {type === "bearer" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Token</label>
          <input type="password" value={String(field("token"))} onChange={(e) => set("token", e.target.value)} />
        </div>
      )}
      {type === "basic" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Username</label>
          <input value={String(field("username"))} onChange={(e) => set("username", e.target.value)} />
          <label className="small muted">Password</label>
          <input type="password" value={String(field("password"))} onChange={(e) => set("password", e.target.value)} />
        </div>
      )}
      {type === "digest" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Username</label>
          <input value={String(field("username"))} onChange={(e) => set("username", e.target.value)} />
          <label className="small muted">Password</label>
          <input type="password" value={String(field("password"))} onChange={(e) => set("password", e.target.value)} />
        </div>
      )}
      {type === "oauth2" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Access token</label>
          <input type="password" value={String(field("accessToken"))} onChange={(e) => set("accessToken", e.target.value)} />
          <label className="small muted">Token type</label>
          <input value={String(field("tokenType") ?? "Bearer")} onChange={(e) => set("tokenType", e.target.value)} />
        </div>
      )}
      {type === "awsv4" && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <label className="small muted">Access key</label>
          <input value={String(field("accessKey"))} onChange={(e) => set("accessKey", e.target.value)} />
          <label className="small muted">Secret key</label>
          <input type="password" value={String(field("secretKey"))} onChange={(e) => set("secretKey", e.target.value)} />
          <label className="small muted">Region</label>
          <input value={String(field("region") ?? "us-east-1")} onChange={(e) => set("region", e.target.value)} />
          <label className="small muted">Service</label>
          <input value={String(field("service") ?? "execute-api")} onChange={(e) => set("service", e.target.value)} />
        </div>
      )}
      {type === "custom" && (
        <div className="small muted">
          Custom auth headers are appended by scripts (pm.request.headers) or the API key helper. Use the
          environment variable syntax in values.
        </div>
      )}
      {type === "none" && <div className="small muted">No authorization. The request will inherit collection auth if configured.</div>}

      <div className="small muted" style={{ marginTop: 12 }}>
        Values support <span className="ds-mono">{"{{variable}}"}</span> and <span className="ds-mono">{"{{$secret.key}}"}</span> resolution.
      </div>
    </div>
  );
}