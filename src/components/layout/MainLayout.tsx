import type { ReactNode } from "react";

interface MainLayoutProps {
  sidebarLeft: ReactNode;
  children: ReactNode;
  sidebarRight: ReactNode;
}

export function MainLayout({ sidebarLeft, children, sidebarRight }: MainLayoutProps) {
  return (
    <div className="min-h-screen tf-texture">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b-[3px] border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl tracking-wider">
              <span className="text-team-red">FORT</span>
              <span className="text-tf-beige">KUT</span>
            </h1>
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest hidden sm:block">
              Social Warfare Network
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { label: "Feed", icon: "📋", active: true },
              { label: "Scraps", icon: "📝", active: false },
              { label: "Comunidades", icon: "🏰", active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider transition-all
                  ${item.active
                    ? "bg-accent text-accent-foreground tf-shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <span className="mr-1">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            {sidebarLeft}
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-6 space-y-4">
            {children}
          </main>

          {/* Right Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            {sidebarRight}
          </aside>
        </div>
      </div>
    </div>
  );
}
