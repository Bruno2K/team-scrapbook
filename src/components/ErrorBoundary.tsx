import type { ReactNode } from "react";
import { Component } from "react";

// #region agent log
const _logError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "Error";
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "ErrorBoundary",
      message: "render_error",
      data: { err: msg, name, stack: err instanceof Error ? err.stack : undefined },
      timestamp: Date.now(),
      hypothesisId: "H1",
    }),
  }).catch(() => {});
  console.error("[ErrorBoundary]", err);
};
// #endregion

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    _logError(error);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="p-6 max-w-lg mx-auto text-center space-y-2">
          <p className="font-heading text-sm text-destructive">Algo deu errado</p>
          <p className="text-xs text-muted-foreground font-mono break-all">{this.state.error.message}</p>
          <button
            type="button"
            className="text-xs text-accent underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
