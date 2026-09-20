import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isApiConfigured } from "@/api/client";
import { useAuthStatus } from "@/auth/useAuthSession";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const status = useAuthStatus();

  if (status === "bootstrapping") {
    return (
      <div className="min-h-screen tf-texture flex items-center justify-center">
        <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
          Carregando sessão...
        </p>
      </div>
    );
  }

  if (!isApiConfigured()) {
    return <>{children}</>;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
