import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
try {
  root.render(<App />);
} catch (e) {
  const err = e as Error;
  console.error("[main.tsx] Render error:", err?.message, err?.stack);
  root.render(
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600 }}>
      <h2 style={{ color: "#dc2626" }}>Erro ao carregar</h2>
      <pre style={{ background: "#fef2f2", padding: 12, overflow: "auto", fontSize: 12 }}>{err?.message ?? String(e)}</pre>
      {err?.stack && <pre style={{ fontSize: 10, color: "#666" }}>{err.stack}</pre>}
    </div>
  );
}
