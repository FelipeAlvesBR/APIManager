import { useApp } from "../store";

export function TopBar({ onOpenPalette, onOpenAi }: { onOpenPalette: () => void; onOpenAi: () => void }) {
  const user = useApp((s) => s.user);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const selectWorkspace = useApp((s) => s.selectWorkspace);
  const environments = useApp((s) => s.environments);
  const activeEnvironmentId = useApp((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useApp((s) => s.setActiveEnvironment);
  const createWorkspace = useApp((s) => s.createWorkspace);
  const logout = useApp((s) => s.logout);

  return (
    <header className="topbar">
      <strong style={{ color: "var(--accent)", letterSpacing: "-0.02em" }}>API Platform</strong>

      <select
        className="sm"
        value={activeWorkspaceId ?? ""}
        onChange={(e) => void selectWorkspace(e.target.value)}
        title="Workspace"
        aria-label="Select workspace"
      >
        {workspaces.map((w) => (
          <option key={String(w["id"])} value={String(w["id"])}>
            {String(w["name"])}
          </option>
        ))}
      </select>

      <select
        value={activeEnvironmentId ?? ""}
        onChange={(e) => setActiveEnvironment(e.target.value || null)}
        title="Active environment"
        aria-label="Select environment"
      >
        <option value="">No environment</option>
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>

      <div className="grow" />

      <button className="ds-btn ghost small" onClick={onOpenPalette} title="Command palette (Ctrl/Cmd+K)">
        <span className="muted">Search / actions</span> <kbd>⌘K</kbd>
      </button>
      <button
        className="ds-btn sm"
        onClick={async () => {
          const name = window.prompt("Workspace name");
          if (name) await createWorkspace(name);
        }}
      >
        + Workspace
      </button>
      <button className="ds-btn sm" onClick={onOpenAi} title="Open AI assistant (bring-your-own model)">
        AI
      </button>
      <div className="dropdown">
        <button className="ds-btn sm" aria-label="Account menu">
          {user?.name ?? "Account"}
        </button>
      </div>
      <button className="ds-btn ghost sm muted" onClick={logout} title="Sign out">
        Sign out
      </button>
    </header>
  );
}