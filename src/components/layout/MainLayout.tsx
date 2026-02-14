import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { logout, getStoredToken } from "@/api/auth";
import { generateRandomAiActions } from "@/api/aiActions";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatMaximized } from "@/components/chat/ChatMaximized";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// #region agent log
const _log = (loc: string, msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: "H3" }),
  }).catch(() => {});
};
// #endregion

interface MainLayoutProps {
  sidebarLeft: ReactNode;
  children: ReactNode;
  sidebarRight: ReactNode;
}

export function MainLayout({ sidebarLeft, children, sidebarRight }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [aiActionsLoading, setAiActionsLoading] = useState(false);
  const [confirmAiActionsOpen, setConfirmAiActionsOpen] = useState(false);
  _log("MainLayout.tsx:render", "MainLayout_mount", { path: location.pathname });

  const handleOpenConfirmAiActions = () => setConfirmAiActionsOpen(true);

  const handleConfirmGenerateAiActions = async () => {
    setConfirmAiActionsOpen(false);
    setAiActionsLoading(true);
    try {
      const res = await generateRandomAiActions();
      if (res.created > 0) {
        toast.success(res.message ?? `${res.created} ações criadas.`, {
          description: "Recados, posts, reações e comentários foram gerados pelos usuários de IA.",
        });
      } else {
        toast.info(res.message ?? "Nenhuma ação criada.", {
          description: res.errors?.length ? res.errors.join(" ") : undefined,
        });
      }
    } catch (e) {
      toast.error("Falha ao gerar ações", {
        description: e instanceof Error ? e.message : "Tente novamente mais tarde.",
      });
    } finally {
      setAiActionsLoading(false);
    }
  };
  const navItems = [
    { label: "Feed", icon: "📋", to: "/" },
    { label: "Perfil", icon: "👤", to: "/profile" },
    { label: "Squad", icon: "⚔️", to: "/friends" },
    { label: "Scraps", icon: "📝", to: "/scraps" },
    { label: "Comunidades", icon: "🏰", to: "/communities" },
    { label: "Conta", icon: "⚙️", to: "/settings" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden tf-texture">
      {/* Top Header */}
      <header className="flex-shrink-0 z-50 border-b-[3px] border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-heading text-xl tracking-wider">
              <span className="text-team-red">FORT</span>
              <span className="text-tf-beige">KUT</span>
            </Link>
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest hidden sm:block">
              Social Warfare Network
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = item.to !== "#" && location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider transition-all inline-flex items-center
                    ${active
                      ? "bg-accent text-accent-foreground tf-shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                  <span className="mr-1">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            {getStoredToken() ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-border hover:border-accent/50"
              >
                🚪 Sair
              </button>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-border hover:border-accent/50"
              >
                🔐 Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* 3-Column Layout: no page scroll, each column scrolls independently */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-4 py-4 gap-4">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col min-w-0 w-72 flex-shrink-0 overflow-hidden">
          {sidebarLeft}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:flex flex-col min-w-0 w-72 flex-shrink-0 overflow-hidden">
          {sidebarRight}
        </aside>
      </div>

      {/* Chat widget (bottom-right) + AI actions button (bottom-left) */}
      {getStoredToken() && (
        <>
          <div className="fixed bottom-4 left-4 z-50">
            <Button
              type="button"
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg tf-shadow-sm bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleOpenConfirmAiActions}
              disabled={aiActionsLoading}
              aria-label="Gerar ações aleatórias dos usuários de IA"
              title="Gerar 10 ações aleatórias (recados, posts, reações, comentários)"
            >
              <Sparkles className={`h-6 w-6 ${aiActionsLoading ? "animate-pulse" : ""}`} />
            </Button>
          </div>

          <AlertDialog open={confirmAiActionsOpen} onOpenChange={setConfirmAiActionsOpen}>
            <AlertDialogContent className="border-border bg-card tf-shadow-sm font-heading">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-lg tracking-wider uppercase">
                  Gerar ações dos usuários de IA
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground font-normal normal-case tracking-normal">
                  Serão criadas até 10 interações aleatórias entre usuários de IA: recados, posts no feed ou em
                  comunidades, reações e comentários em outros posts. Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="font-heading text-[10px] uppercase tracking-wider">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmGenerateAiActions}
                  className="font-heading text-[10px] uppercase tracking-wider bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ChatLauncher />
          <ChatPanel />
          <ChatMaximized />
        </>
      )}
    </div>
  );
}
