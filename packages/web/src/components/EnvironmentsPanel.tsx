import { useState } from "react";
import type { Environment, VariableDefinition } from "@apiplatform/shared";
import { useApp } from "../store";
import { api } from "../api";

export function EnvironmentsPanel() {
  const environments = useApp((s) => s.environments);
  const activeEnvironmentId = useApp((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useApp((s) => s.setActiveEnvironment);
  const loadEnvironments = useApp((s) => s.loadEnvironments);
  const globals = useApp((s) => s.globals);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const toast = useApp((s) => s.toast);
  const [editor, setEditor] = useState<Environment | null>(null);
  const [showGlobals, setShowGlobals] = useState(false);

  return (
    <>
      <button
        className="tree-item"
        onClick={async () => {
          const name = window.prompt("Environment name");
          if (!name || !activeWorkspaceId) return;
          await api.createEnvironment(activeWorkspaceId, { name });
          await loadEnvironments();
        }}
      >
        ＋ New environment
      </button>
      {environments.map((env) => (
        <div
          key={env.id}
          className={"tree-item" + (activeEnvironmentId === env.id ? " active" : "")}
          onClick={() => setActiveEnvironment(env.id)}
          onDoubleClick={() => setEditor(env)}
          title="Double-click to edit"
        >
          <span className="grow">{env.name}</span>
          {activeEnvironmentId === env.id && <span className="ds-badge success">active</span>}
        </div>
      ))}
      <button className="tree-item muted small" onClick={() => setShowGlobals((v) => !v)}>
        {showGlobals ? "▾" : "▸"} Global variables ({globals.length})
      </button>
      {showGlobals && <GlobalVariablesEditor />}
      <div className="side-header" style={{ marginTop: 10 }}>
        <span>Secrets vault</span>
      </div>
      <SecretsVault />

      {editor && <EnvironmentEditor env={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function GlobalVariablesEditor() {
  const globals = useApp((s) => s.globals);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const toast = useApp((s) => s.toast);
  const [rows, setRows] = useState<VariableDefinition[]>(globals.length ? globals : [{ name: "", value: "", enabled: true }]);

  return (
    <div style={{ padding: "4px 12px" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <input
            style={{ width: 90 }}
            placeholder="name"
            value={r.name}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
          />
          <input
            className="grow"
            placeholder="value"
            value={r.value}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
          <input
            type="checkbox"
            checked={r.enabled}
            title="enabled"
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="ds-btn sm" onClick={() => setRows([...rows, { name: "", value: "", enabled: true }])}>
          + Row
        </button>
        <button
          className="ds-btn primary sm"
          onClick={async () => {
            if (!activeWorkspaceId) return;
            await api.setGlobals(activeWorkspaceId, rows.filter((r) => r.name));
            await useApp.getState().loadEnvironments();
            toast("success", "Globals saved");
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SecretsVault() {
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const toast = useApp((s) => s.toast);
  const [secrets, setSecrets] = useState<{ key: string; updatedAt: string }[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div style={{ padding: "4px 12px" }}>
      <button
        className="ds-btn sm"
        onClick={async () => {
          if (!activeWorkspaceId) return;
          const res = await api.listSecrets(activeWorkspaceId);
          setSecrets(res.secrets);
        }}
      >
        Refresh
      </button>
      {secrets.map((s) => (
        <div key={s.key} className="small muted" style={{ padding: "2px 0" }}>
          🔒 {s.key}
        </div>
      ))}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <input style={{ width: 90 }} placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
        <input
          className="grow"
          type="password"
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <button
        className="ds-btn primary sm"
        style={{ marginTop: 6 }}
        onClick={async () => {
          if (!activeWorkspaceId || !key) return;
          await api.setSecret(activeWorkspaceId, key, value);
          setKey("");
          setValue("");
          toast("success", "Secret stored (encrypted at rest)");
          const res = await api.listSecrets(activeWorkspaceId);
          setSecrets(res.secrets);
        }}
      >
        Store secret
      </button>
      <div className="small muted" style={{ marginTop: 6 }}>
        Reference with <span className="ds-mono">{"{{$secret.key}}"}</span>
      </div>
    </div>
  );
}

function EnvironmentEditor({ env, onClose }: { env: Environment; onClose: () => void }) {
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const toast = useApp((s) => s.toast);
  const loadEnvironments = useApp((s) => s.loadEnvironments);
  const [rows, setRows] = useState<VariableDefinition[]>(
    env.variables.length ? env.variables : [{ name: "", value: "", enabled: true }],
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit environment: {env.name}</h2>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <input
              style={{ width: 120 }}
              placeholder="name"
              value={r.name}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className="grow"
              placeholder="value"
              value={r.value}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <label title="secret" className="small muted" style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <input
                type="checkbox"
                checked={Boolean(r.secret)}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, secret: e.target.checked } : x)))}
              />
              secret
            </label>
            <input
              type="checkbox"
              title="enabled"
              checked={r.enabled}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="ds-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ds-btn primary"
            onClick={async () => {
              if (!activeWorkspaceId) return;
              await api.updateEnvironment(activeWorkspaceId, env.id, { variables: rows.filter((r) => r.name) });
              await loadEnvironments();
              toast("success", "Environment saved");
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}