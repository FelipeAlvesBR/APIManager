import { useApp } from "../store";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismissToast = useApp((s) => s.dismissToast);
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind} role="status">
          {t.message}
          <button className="ds-btn ghost icon sm" style={{ float: "right", marginTop: -3 }} onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}