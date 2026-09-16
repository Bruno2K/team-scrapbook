import { z } from "zod";
import { canChat } from "../../relationships/index.js";

export interface ConversationParticipants {
  user1Id: string;
  user2Id: string;
}

export interface MessagingPolicyRepository {
  getParticipants(conversationId: string): Promise<ConversationParticipants | null>;
}

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video", "audio", "document"]),
  filename: z.string().max(255).optional(),
}).strict();

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1).max(128),
  content: z.string().max(4000).nullable().optional(),
  type: z.enum(["TEXT", "AUDIO", "VIDEO", "DOCUMENT"]).default("TEXT"),
  attachments: z.array(attachmentSchema).max(5).optional().default([]),
}).strict().refine(
  (value) => Boolean(value.content?.trim() || value.attachments.length),
  { message: "Conteúdo ou anexos são obrigatórios" },
);

export type SendMessagePayload = z.infer<typeof sendMessageSchema>;

export function createMessagingPolicy(repository: MessagingPolicyRepository) {
  async function getOtherParticipant(conversationId: string, actorId: string): Promise<string | null> {
    const participants = await repository.getParticipants(conversationId);
    if (!participants) return null;
    if (participants.user1Id === actorId) return participants.user2Id;
    if (participants.user2Id === actorId) return participants.user1Id;
    return null;
  }

  return {
    getOtherParticipant,
    async canAccessConversation(conversationId: string, actorId: string): Promise<boolean> {
      return Boolean(await getOtherParticipant(conversationId, actorId));
    },
    async canSendOrSignal(conversationId: string, actorId: string): Promise<boolean> {
      const otherActorId = await getOtherParticipant(conversationId, actorId);
      return Boolean(otherActorId && await canChat(actorId, otherActorId));
    },
  };
}
