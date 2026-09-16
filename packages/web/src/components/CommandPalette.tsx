import { useEffect, useMemo, useState } from "react";
import type { ApiRequest } from "@apiplatform/shared";
import { useApp } from "../store";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const requests = useApp((s) => s.requests);
  const collections = useApp((s) => s.collections);
  const history = useApp((s) => s.history);
  const selectRequest = useApp((s) => s.selectRequest);
  const newRequest = useApp((s) => s.newRequest);
  const send = useApp((s) => s.send);
  const saveRequest = useApp((s) => s.saveRequest);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const actions = useMemo(() => {
    const q = query.toLowerCase();
    const list: { label: string; hint?: string; run: () => void }[] = [
      {
        label: "New request",
        hint: "Ctrl+N",
        run: () => {
          newRequest();
          onClose();
        },
      },
      {
        label: "Send request",
        hint: "Ctrl+Enter",
        run: () => {
          void send();
          onClose();
        },
      },
      {
        label: "Save request",
        hint: "Ctrl+S",
        run: () => {
          const req = useApp.getState().activeRequest;
          if (req) void saveRequest(req as Partial<ApiRequest>);
          onClose();
        },
      },
      ...requests
        .filter((r) => (r.name + r.url).toLowerCase().includes(q))
        .slice(0, 12)
        .map((r) => ({
          label: r.name,
          hint: r.method,
          run: () => {
            void selectRequest(r.id);
            onClose();
          },
        })),
      ...history
        .filter((h) => (h.url + h.method).toLowerCase().includes(q))
        .slice(0, 6)
        .map((h) => ({
          label: `History · ${h.method} ${h.url}`,
          run: () => {
            void selectRequest(h.id).catch(() => {});
            onClose();
          },
        })),
      ...collections
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 6)
        .map((c) => ({
          label: `Collection · ${c.name}`,
          run: () => {
            void useApp.getState().loadCollection(c.id);
            onClose();
          },
        })),
    ];
    return list;
  }, [query, requests, history, collections, newRequest, onClose, selectRequest, send, saveRequest]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 480, padding: 8 }}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search requests…"
          style={{ width: "100%", padding: "10px 12px", fontSize: 14 }}
        />
        <div className="scroll" style={{ maxHeight: 360, marginTop: 6 }}>
          {actions.map((a, i) => (
            <button key={i} className="dropdown-item" onClick={a.run} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{a.label}</span>
              {a.hint && <span className="small muted ds-mono">{a.hint}</span>}
            </button>
          ))}
          {actions.length === 0 && <div className="center-panel small">No matches</div>}
        </div>
      </div>
    </div>
  );
}