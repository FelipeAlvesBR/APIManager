import { useState, type FormEvent } from "react";
import { useApp } from "../store";
import { ApiError } from "../api";

export function AuthPage() {
  const login = useApp((s) => s.login);
  const register = useApp((s) => s.register);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@apiplatform.dev");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("demo12345");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, name, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 20 }}>
      <form onSubmit={submit} style={{ width: 380, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 28 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>API Platform</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Postman-like API workspace, offline-friendly, with a bring-your-own-model AI assistant.</p>

        {error && (
          <div style={{ background: "rgba(226,85,99,.12)", color: "var(--error)", padding: "8px 10px", borderRadius: 4, marginBottom: 12, fontSize: 13 }} role="alert">
            {error}
          </div>
        )}

        {mode === "register" && (
          <label style={{ display: "block", marginBottom: 10 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} required />
          </label>
        )}
        <label style={{ display: "block", marginBottom: 10 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} required />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} required minLength={8} />
        </label>

        <button className="ds-btn primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div className="small muted" style={{ marginTop: 14, textAlign: "center" }}>
          {mode === "login" ? (
            <>No account? <button type="button" onClick={() => setMode("register")} style={{ color: "var(--accent)" }}>Create one</button></>
          ) : (
            <>Have an account? <button type="button" onClick={() => setMode("login")} style={{ color: "var(--accent)" }}>Sign in</button></>
          )}
        </div>
        <div className="small" style={{ marginTop: 10, textAlign: "center", color: "var(--text-faint)" }}>
          Demo: demo@apiplatform.dev / demo12345
        </div>
      </form>
    </div>
  );
}