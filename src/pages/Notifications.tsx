import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useNotifications";
import type { Notification as NotificationType } from "@/api/notifications";

function notificationLabel(type: string): string {
  switch (type) {
    case "SCRAP": return "Recado";
    case "FRIEND_REQUEST": return "Solicitação de amizade";
    case "COMMUNITY_INVITE": return "Convite para comunidade";
    case "CHAT_MESSAGE": return "Mensagem de chat";
    case "COMMUNITY_JOIN_REQUEST": return "Solicitação de entrada em comunidade";
    default: return "Notificação";
  }
}

function notificationLink(n: NotificationType): { to: string; label: string } {
  switch (n.type) {
    case "SCRAP":
      return { to: "/scraps", label: "Ver recados" };
    case "FRIEND_REQUEST":
      return { to: "/friends", label: "Ver solicitações" };
    case "COMMUNITY_INVITE":
      return { to: n.payload.communityId ? `/communities/${n.payload.communityId}` : "/communities", label: "Ver comunidade" };
    case "CHAT_MESSAGE":
      return { to: "/friends", label: "Abrir chat" };
    case "COMMUNITY_JOIN_REQUEST":
      return { to: n.payload.communityId ? `/communities/${n.payload.communityId}` : "/communities", label: "Ver comunidade" };
    default:
      return { to: "#", label: "Ver" };
  }
}

export default function Notifications() {
  const { notifications, isLoading } = useNotifications({ limit: 30 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleClick = (n: NotificationType) => {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
  };

  return (
    <MainLayout
      sidebarLeft={<SidebarLeft />}
      sidebarRight={<SidebarRight />}
    >
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
            🔔 Notificações
          </h1>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-[10px] font-heading uppercase tracking-wider text-accent hover:underline disabled:opacity-50"
              >
                Marcar todas como lidas
              </button>
            )}
            <Link
              to="/"
              className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
            >
              ← Voltar ao Feed
            </Link>
          </div>
        </div>

        <div className="list-scroll flex-1 min-h-0 pr-1">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando notificações...</p>
          ) : notifications.length === 0 ? (
            <div className="tf-card p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação.
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => {
                const { to, label } = notificationLink(n);
                return (
                  <li key={n.id}>
                    <Link
                      to={to}
                      onClick={() => handleClick(n)}
                      className={`block tf-card p-3 rounded border transition-colors hover:bg-muted/50 ${!n.readAt ? "border-accent/50 bg-accent/5" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm ${!n.readAt ? "font-semibold" : "text-muted-foreground"}`}>
                            {notificationLabel(n.type)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(n.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className="text-[10px] font-heading uppercase text-accent shrink-0">
                          {label}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
