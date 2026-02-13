import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// #region agent log
const _log = (loc: string, msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: "H1" }),
  }).catch(() => {});
};
// #endregion

const root = createRoot(document.getElementById("root")!);
try {
  root.render(<App />);
  _log("main.tsx:render", "app_start", {});
} catch (e) {
  const err = e as Error;
  _log("main.tsx:catch", "app_error", { err: String(e), name: err?.name });
  console.error("[main.tsx] Render error:", err?.message, err?.stack);
  root.render(
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600 }}>
      <h2 style={{ color: "#dc2626" }}>Erro ao carregar</h2>
      <pre style={{ background: "#fef2f2", padding: 12, overflow: "auto", fontSize: 12 }}>{err?.message ?? String(e)}</pre>
      {err?.stack && <pre style={{ fontSize: 10, color: "#666" }}>{err.stack}</pre>}
    </div>
  );
}
