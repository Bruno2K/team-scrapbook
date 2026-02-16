import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredToken } from "@/api/auth";
import { isApiConfigured } from "@/api/client";
import type { ChatMessage, Conversation } from "@/lib/types";

const baseURL = (import.meta.env.VITE_API_URL as string) ?? "";
const socketOrigin = baseURL.replace(/\/$/, "");

export interface ChatContextValue {
  socketConnected: boolean;
  sendMessageViaSocket: (
    conversationId: string,
    payload: { content?: string | null; type: string; attachments?: Array<{ url: string; type: string; filename?: string }> }
  ) => void;
  emitTyping: (conversationId: string) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  isMaximized: boolean;
  setMaximized: (v: boolean) => void;
  openConversationWith: (conversation: Conversation | null) => void;
  lastMessage: ChatMessage | null;
  clearLastMessage: () => void;
  typingUserId: string | null;
  typingConversationId: string | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const CONVERSATIONS_QUERY_KEY = ["chat", "conversations"] as const;
function messagesQueryKey(conversationId: string) {
  return ["chat", "messages", conversationId] as const;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [isMaximized, setMaximized] = useState(false);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openConversationWith = useCallback((conversation: Conversation | null) => {
    if (conversation) {
      setActiveConversationId(conversation.id);
      setPanelOpen(true);
    } else {
      setActiveConversationId(null);
    }
  }, []);

  const clearLastMessage = useCallback(() => setLastMessage(null), []);

  useEffect(() => {
    if (!isApiConfigured()) return;
    const token = getStoredToken();
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
      return;
    }
    const socket = io(socketOrigin, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("message", (msg: ChatMessage) => {
      setLastMessage(msg);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(msg.conversationId) });
    });
    socket.on("notification", () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "notifications"] });
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        // ignore if AudioContext not supported
      }
    });
    socket.on("typing", (payload: { conversationId: string; userId: string }) => {
      setTypingConversationId(payload.conversationId);
      setTypingUserId(payload.userId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUserId(null);
        setTypingConversationId(null);
        typingTimeoutRef.current = null;
      }, 3000);
    });
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [queryClient]);

  const sendMessageViaSocket = useCallback(
    (
      conversationId: string,
      payload: {
        content?: string | null;
        type: string;
        attachments?: Array<{ url: string; type: string; filename?: string }>;
      }
    ) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("message", { conversationId, ...payload });
      }
    },
    []
  );

  const emitTyping = useCallback((conversationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing", { conversationId });
    }
  }, []);

  const value: ChatContextValue = {
    socketConnected,
    sendMessageViaSocket,
    emitTyping,
    activeConversationId,
    setActiveConversationId,
    isPanelOpen,
    setPanelOpen,
    isMaximized,
    setMaximized,
    openConversationWith,
    lastMessage,
    clearLastMessage,
    typingUserId,
    typingConversationId,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function useChatOptional() {
  return useContext(ChatContext);
}
