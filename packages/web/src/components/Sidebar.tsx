import { useState } from "react";
import type { ApiRequest } from "@apiplatform/shared";
import { useApp } from "../store";
import { api, authHeaders } from "../api";
import { EnvironmentsPanel } from "./EnvironmentsPanel";

function methodClass(m: string): string {
  const base = "method-badge method-" + m.toUpperCase();
  return base;
}

export function Sidebar() {
  const collections = useApp((s) => s.collections);
  const collectionsTree = useApp((s) => s.collectionsTree);
  const history = useApp((s) => s.history);
  const activeRequest = useApp((s) => s.activeRequest);
  const selectRequest = useApp((s) => s.selectRequest);
  const newRequest = useApp((s) => s.newRequest);
  const createCollection = useApp((s) => s.createCollection);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  const toast = useApp((s) => s.toast);
  const [tab, setTab] = useState<"collections" | "history" | "environments">("collections");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState("curl");
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  async function handleImport() {
    if (!activeWorkspaceId) return;
    setImportBusy(true);
    try {
      const result = await api.importData(activeWorkspaceId, { type: importType, content: importText });
      await useApp.getState().loadCollections();
      const reqs = (result.requests as unknown[]) ?? [];
      toast("success", `Imported ${reqs.length} request(s)`);
      if (reqs.length) {
        await selectRequest((reqs[0] as { id: string }).id);
      }
      setImportOpen(false);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="tabs" role="tablist">
        {(["collections", "history", "environments"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={"tab" + (tab === t ? " active" : "")}
            onClick={() => setTab(t)}
            style={{ fontSize: 12, textTransform: "capitalize" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="side-header">
        <span>{tab === "collections" ? "Collections" : tab === "history" ? "History" : "Environments"}</span>
        <span style={{ display: "flex", gap: 4 }}>
          {tab === "collections" && (
            <>
              <button
                className="ds-btn ghost icon sm"
                title="Import"
                onClick={() => setImportOpen(true)}
              >
                ⇪
              </button>
              <button
                className="ds-btn ghost icon sm"
                title="New collection"
                onClick={async () => {
                  const name = window.prompt("Collection name");
                  if (name) await createCollection(name);
                }}
              >
                +
              </button>
            </>
          )}
        </span>
      </div>

      <div className="grow scroll" style={{ paddingBottom: 8 }}>
        {tab === "collections" && (
          <>
            <button className="tree-item" onClick={newRequest} style={{ color: "var(--accent)" }}>
              ＋ New Request
            </button>
            {collections.length === 0 && (
              <div className="center-panel small" style={{ padding: 24 }}>
                No collections yet.
                <br />
                Import a cURL command, an OpenAPI file, or a Postman collection.
              </div>
            )}
            {collections.map((c) => {
              const isOpen = expanded[c.id];
              const tree = collectionsTree[c.id];
              const folderList = (tree?.folders ?? []) as { id: string; name: string }[];
              const requests = (tree?.requests ?? []) as ApiRequest[];
              const folderRequests = (fid: string | null) =>
                requests.filter((r) => (r.folderId ?? null) === fid);
              return (
                <div key={c.id}>
                  <div
                    className="tree-item"
                    style={{ fontWeight: 600 }}
                    onClick={() => toggleExpand(c.id)}
                  >
                    <span style={{ color: "var(--text-faint)" }}>{isOpen ? "▾" : "▸"}</span> {c.name}
                  </div>
                  {isOpen && (
                    <div>
                      {folderList.map((f) => (
                        <div key={f.id}>
                          <div className="tree-item" onClick={() => toggleExpand(f.id)}>
                            <span style={{ color: "var(--text-faint)" }}>▾</span> {f.name}
                          </div>
                          {folderRequests(f.id).map((r) => (
                            <RequestItem key={r.id} r={r} activeId={activeRequest?.id} onSelect={() => void selectRequest(r.id)} />
                          ))}
                        </div>
                      ))}
                      {folderRequests(null).map((r) => (
                        <RequestItem key={r.id} r={r} activeId={activeRequest?.id} onSelect={() => void selectRequest(r.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 && <div className="center-panel small">No requests sent yet.</div>}
            {history.map((h) => (
              <div key={h.id} className="tree-item" onClick={() => void replay(h.id)} title={h.url}>
                <span className={methodClass(h.method)}>{h.method}</span>
                <span className="muted">{h.status ?? "—"}</span>
                <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {h.url}
                </span>
              </div>
            ))}
          </>
        )}

        {tab === "environments" && <EnvironmentsPanel />}
      </div>

      {importOpen && (
        <div className="modal-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import</h2>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {["curl", "postman", "openapi-json", "openapi-yaml"].map((t) => (
                <button
                  key={t}
                  className={"ds-btn sm" + (importType === t ? " primary" : "")}
                  onClick={() => setImportType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              rows={10}
              style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 12 }}
              placeholder={importType === "curl" ? "curl https://api.example.com/users" : "Paste collection / spec here"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ds-btn" onClick={() => setImportOpen(false)}>
                Cancel
              </button>
              <button className="ds-btn primary" onClick={() => void handleImport()} disabled={importBusy || !importText.trim()}>
                {importBusy ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function RequestItem({ r, activeId, onSelect }: { r: ApiRequest; activeId?: string; onSelect: () => void }) {
  const deleteRequest = useApp((s) => s.deleteRequest);
  const toast = useApp((s) => s.toast);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);
  return (
    <div
      className={"tree-item" + (activeId === r.id ? " active" : "")}
      onClick={onSelect}
      style={{ paddingLeft: 24 }}
      title={r.url}
    >
      <span className={methodClass(r.method)}>{r.method}</span>
      <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {r.name}
      </span>
      <button
        className="ds-btn ghost icon sm"
        title="Delete"
        onClick={async (e) => {
          e.stopPropagation();
          if (!window.confirm("Delete this request?")) return;
          if (activeWorkspaceId) await deleteRequest(activeWorkspaceId, r.id);
          toast("info", "Request deleted");
        }}
      >
        ✕
      </button>
    </div>
  );
}

async function replay(id: string) {
  const ws = useApp.getState().activeWorkspaceId;
  if (!ws) return;
  try {
    const res = await fetch(`/api/history/${ws}/${id}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    const data = await res.json();
    if (res.ok) {
      useApp.setState({ response: data.response });
      await useApp.getState().loadHistory();
    } else {
      useApp.getState().toast("error", data?.error?.message ?? "Replay failed");
    }
  } catch (e) {
    useApp.getState().toast("error", e instanceof Error ? e.message : "Replay failed");
  }
}