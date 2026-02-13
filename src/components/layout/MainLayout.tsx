import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

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
  _log("MainLayout.tsx:render", "MainLayout_mount", { path: location.pathname });
  const navItems = [
    { label: "Feed", icon: "📋", to: "/" },
    { label: "Squad", icon: "⚔️", to: "/friends" },
    { label: "Scraps", icon: "📝", to: "/scraps" },
    { label: "Comunidades", icon: "🏰", to: "/communities" },
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
            <Link
              to="/login"
              className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-border hover:border-accent/50"
            >
              🔐 Entrar
            </Link>
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
    </div>
  );
}
