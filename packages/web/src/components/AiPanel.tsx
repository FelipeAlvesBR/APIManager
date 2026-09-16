import { useEffect, useState } from "react";
import type { AiProvider } from "@apiplatform/shared";
import { useApp } from "../store";
import { api } from "../api";

export function AiPanel({ onClose }: { onClose: () => void }) {
  const workspaceId = useApp((s) => s.activeWorkspaceId);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "system", content: "You are a helpful API engineering assistant. Answer concisely." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [redact, setRedact] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (workspaceId) {
      api.listProviders(workspaceId).then((r) => {
        setProviders(r.providers);
        if (r.providers[0]) setSelected(r.providers[0]!.id);
      });
    }
  }, [workspaceId]);

  async function refresh() {
    if (!workspaceId) return;
    const r = await api.listProviders(workspaceId);
    setProviders(r.providers);
    if (!selected && r.providers[0]) setSelected(r.providers[0]!.id);
  }

  async function saveProvider() {
    if (!workspaceId) return;
    await api.createProvider(workspaceId, {
      name: form.name || form.model,
      baseUrl: form.baseUrl,
      model: form.model,
      apiKey: form.apiKey || undefined,
      apiFormat: (form.apiFormat as never) ?? "openai",
      temperature: form.temperature ? Number(form.temperature) : 0.2,
    });
    await refresh();
    useApp.getState().toast("success", "Provider saved (key stored in encrypted vault)");
    setForm({});
  }

  async function testConnection() {
    if (!workspaceId || !selected) return;
    const r = await api.testProvider(workspaceId, selected);
    useApp.getState().toast(
      r.overall ? "success" : "error",
      r.overall ? "Provider healthy" : "Provider has failing checks",
    );
    // Surface the check details
    const lines = r.checks.map((c) => `${c.ok ? "✓" : "✕"} ${c.name}: ${c.detail}`).join("\n");
    alert(lines);
  }

  async function sendMessage() {
    if (!workspaceId || !selected || !input.trim()) return;
    const next = [...messages, { role: "user" as const, content: input }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api.chat(workspaceId, {
        providerId: selected,
        messages: next,
        redact,
      });
      setMessages([...next, { role: "assistant", content: r.content }]);
      if (r.redacted) {
        useApp.getState().toast("info", "Potential secrets were redacted before submission");
      }
    } catch (e) {
      useApp.getState().toast("error", e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ position: "fixed", right: 0, top: 0, bottom: 0, height: "100vh", maxHeight: "100vh", width: 460, borderRadius: 0, borderRight: "none", display: "flex", flexDirection: "column" }}
        role="dialog"
        aria-label="AI assistant"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>AI Assistant</h2>
          <span className="grow" />
          <span className="ds-badge muted">BYO model</span>
          <button className="ds-btn ghost icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Providers */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <select className="grow" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="AI provider">
              {providers.length === 0 && <option value="">No providers — add one below</option>}
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.model}
                </option>
              ))}
            </select>
            <button className="ds-btn sm" onClick={() => void testConnection()} disabled={!selected}>
              Test
            </button>
            <button className="ds-btn sm" onClick={() => void refresh()}>
              ⟳
            </button>
          </div>

          {providers.length === 0 && (
            <div className="small muted" style={{ marginTop: 8 }}>
              Connect any OpenAI-compatible endpoint — self-hosted Ollama, a company gateway, or a public API.
              Keys are stored in the encrypted secrets vault.
            </div>
          )}
        </div>

        {/* Add provider */}
        <details style={{ marginTop: 8 }}>
          <summary className="small" style={{ cursor: "pointer" }}>Add a provider</summary>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 6, marginTop: 8 }}>
            <label className="small muted">Name</label>
            <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label className="small muted">Base URL</label>
            <input placeholder="https://gateway.company.example/v1" value={form.baseUrl ?? ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            <label className="small muted">Model</label>
            <input placeholder="model-name" value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <label className="small muted">API key (optional)</label>
            <input type="password" value={form.apiKey ?? ""} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
            <label className="small muted">Format</label>
            <select value={form.apiFormat ?? "openai"} onChange={(e) => setForm({ ...form, apiFormat: e.target.value })}>
              <option value="openai">OpenAI-compatible</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <button className="ds-btn primary sm" style={{ marginTop: 8 }} onClick={() => void saveProvider()}>
            Save provider
          </button>
        </details>

        <div className="ds-divider" style={{ margin: "10px 0" }} />

        {/* Conversation */}
        <div className="grow scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ maxWidth: "90%", alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  background: m.role === "user" ? "var(--accent-muted)" : "var(--bg-hover)",
                  border: "1px solid var(--border)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="small muted">Thinking…</div>}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <input
            className="grow"
            placeholder="Ask about a request, generate tests, debug an error…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
            disabled={busy}
          />
          <button className="ds-btn primary" onClick={() => void sendMessage()} disabled={busy || !selected}>
            Send
          </button>
        </div>
        <label className="small muted" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
          <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} />
          Redact credentials before sending to the model
        </label>
      </div>
    </div>
  );
}