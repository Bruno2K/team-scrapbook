import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { logout, getStoredToken } from "@/api/auth";
import { useUnreadCount, useNotifications } from "@/hooks/useNotifications";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatMaximized } from "@/components/chat/ChatMaximized";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  _log("MainLayout.tsx:render", "MainLayout_mount", { path: location.pathname });
  const hasToken = !!getStoredToken();
  const { unreadCount } = useUnreadCount({ enabled: hasToken });
  const { notifications: recentNotifications } = useNotifications({ limit: 10 }, { enabled: hasToken });
  const navItems = [
    { label: "Feed", icon: "📋", to: "/" },
    { label: "Perfil", icon: "👤", to: "/profile" },
    { label: "Squad", icon: "⚔️", to: "/friends" },
    { label: "Scraps", icon: "📝", to: "/scraps" },
    { label: "Comunidades", icon: "🏰", to: "/communities" },
    { label: "Conta", icon: "⚙️", to: "/settings" },
  ];

  const notificationLabel = (type: string) => {
    switch (type) {
      case "SCRAP": return "Novo recado";
      case "FRIEND_REQUEST": return "Solicitação de amizade";
      case "COMMUNITY_INVITE": return "Convite para comunidade";
      case "CHAT_MESSAGE": return "Nova mensagem";
      case "COMMUNITY_JOIN_REQUEST": return "Solicitação de entrada na comunidade";
      default: return "Notificação";
    }
  };

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
            {hasToken && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="relative px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all inline-flex items-center"
                    aria-label="Notificações"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" align="end">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h3 className="font-heading text-xs uppercase tracking-wider">Notificações</h3>
                      <Link
                        to="/notifications"
                        className="text-[10px] font-heading uppercase text-accent hover:underline"
                      >
                        Ver todas
                      </Link>
                    </div>
                    {recentNotifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhuma notificação.</p>
                    ) : (
                      <ul className="space-y-1">
                        {recentNotifications.map((n) => (
                          <li key={n.id}>
                            <Link
                              to="/notifications"
                              className={`block py-2 px-2 rounded text-xs hover:bg-muted ${!n.readAt ? "font-medium" : "text-muted-foreground"}`}
                            >
                              <span className="block">{notificationLabel(n.type)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(n.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {hasToken ? (
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

      {/* Authenticated chat widgets */}
      {getStoredToken() && (
        <>
          <ChatLauncher />
          <ChatPanel />
          <ChatMaximized />
        </>
      )}
    </div>
  );
}
