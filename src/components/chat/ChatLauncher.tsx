import { Button } from "@/components/ui/button";
import { useChatOptional } from "@/contexts/ChatContext";
import { MessageCircle } from "lucide-react";

export function ChatLauncher() {
  const chat = useChatOptional();
  if (!chat) return null;
  const { isPanelOpen, setPanelOpen } = chat;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg tf-shadow-sm bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={() => setPanelOpen(!isPanelOpen)}
        aria-label={isPanelOpen ? "Fechar chat" : "Abrir chat"}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
