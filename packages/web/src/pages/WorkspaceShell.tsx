import { useEffect, useState } from "react";
import type { ApiRequest } from "@apiplatform/shared";
import { useApp } from "../store";
import { TopBar } from "../components/TopBar";
import { Sidebar } from "../components/Sidebar";
import { RequestBuilder } from "../components/RequestBuilder";
import { ResponseViewer } from "../components/ResponseViewer";
import { CommandPalette } from "../components/CommandPalette";
import { AiPanel } from "../components/AiPanel";
import { Toasts } from "../components/Toasts";

export function WorkspaceShell() {
  const activeRequest = useApp((s) => s.activeRequest);
  const sending = useApp((s) => s.sending);
  const send = useApp((s) => s.send);
  const saveRequest = useApp((s) => s.saveRequest);
  const newRequest = useApp((s) => s.newRequest);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Keyboard shortcuts from the spec (section 52).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (!sending) void send();
      } else if (mod && e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        const req = useApp.getState().activeRequest;
        if (req) void saveRequest(req as Partial<ApiRequest>);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newRequest();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, sending, saveRequest, newRequest]);

  return (
    <div className="app-shell">
      <TopBar onOpenPalette={() => setPaletteOpen(true)} onOpenAi={() => setAiOpen(true)} />
      <div className="app-body">
        <Sidebar />
        <div className="workspace-main">
          <div className="request-workbench">
            <RequestBuilder />
            {activeRequest && (
              <div className="response-pane">
                <ResponseViewer />
              </div>
            )}
          </div>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}
      <Toasts />
    </div>
  );
}