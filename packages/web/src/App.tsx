import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./store";
import { AuthPage } from "./pages/AuthPage";
import { WorkspaceShell } from "./pages/WorkspaceShell";

export default function App() {
  const token = useApp((s) => s.token);
  const init = useApp((s) => s.init);

  useEffect(() => {
    if (token) void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/*" element={token ? <WorkspaceShell /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}