import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TF2Class } from "@prisma/client";
import { TF2_PERSONALITY_PROMPTS } from "../config/tf2Personalities.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
// Prefer env override; gemini-1.5-flash is deprecated/renamed in v1beta, use 2.0 or 1.5-pro
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

export interface ChatHistoryMessage {
  role: "user" | "model";
  content: string;
  type?: string;
}

export interface GeminiReplyResult {
  content: string;
  responseType: "text" | "emoji" | "audio" | "image" | "gif";
  attachmentHint?: string;
}

/** Placeholder/catalog URLs for AI response types (image/audio/gif). Key by class or hint. */
const MEDIA_CATALOG: Record<string, Array<{ url: string; type: "image" | "video" | "audio" | "document" }>> = {
  Heavy: [
    { url: "https://wiki.teamfortress.com/w/images/0/03/Heavy_pootis_taunt.wav", type: "audio" },
    { url: "https://wiki.teamfortress.com/w/images/thumb/2/2b/Sandvich.png/200px-Sandvich.png", type: "image" },
  ],
  Medic: [
    { url: "https://wiki.teamfortress.com/w/images/1/17/Medic_specialcompleted07.wav", type: "audio" },
  ],
  Scout: [
    { url: "https://wiki.teamfortress.com/w/images/4/4e/Scout_positivevocalization01.wav", type: "audio" },
  ],
  Soldier: [
    { url: "https://wiki.teamfortress.com/w/images/2/2f/Soldier_specialcompleted07.wav", type: "audio" },
  ],
  default: [
    { url: "https://via.placeholder.com/200x200?text=TF2", type: "image" },
  ],
};

function getCatalogEntries(mainClass: string, hint?: string): Array<{ url: string; type: "image" | "video" | "audio" | "document" }> {
  const byClass = MEDIA_CATALOG[mainClass] ?? MEDIA_CATALOG.default;
  if (hint && byClass.some((e) => e.url.toLowerCase().includes(hint.toLowerCase()))) {
    return byClass.filter((e) => e.url.toLowerCase().includes(hint.toLowerCase()));
  }
  return byClass;
}

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 0);
}

/**
 * Generate a reply as the TF2 character (mainClass). Returns content + optional attachments
 * for audio/image/gif from catalog.
 */
export async function generateReply(
  mainClass: TF2Class,
  nickname: string,
  history: ChatHistoryMessage[],
  lastHumanMessage: string
): Promise<{ content: string; type: "TEXT"; attachments?: Array<{ url: string; type: string; filename?: string }> } | null> {
  if (!isGeminiConfigured()) return null;

  const personality = TF2_PERSONALITY_PROMPTS[mainClass] ?? TF2_PERSONALITY_PROMPTS.Scout;
  const systemPrompt = `You are the ${mainClass} character from Team Fortress 2 in a chat. ${personality}
Your nickname here is ${nickname}. Reply in Portuguese (Brazil) in character, briefly and naturally.
You may respond with: text only, emojis, or indicate you want to send audio/image/gif.
Respond with a single JSON object only, no markdown, no extra text:
{"content":"your message or emoji here","responseType":"text"|"emoji"|"audio"|"image"|"gif","attachmentHint":"optional keyword for media"}
Use responseType "text" or "emoji" for normal replies. Use "audio"/"image"/"gif" only when it fits the character (e.g. Heavy sending sandvich image).`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
    },
  });

  const historyParts = history.map((m) =>
    m.role === "user" ? `Human: ${m.content}` : `${nickname}: ${m.content}`
  );
  const userPrompt = `${historyParts.join("\n")}\nHuman: ${lastHumanMessage}\n${nickname} (reply as JSON):`;

  const callGemini = async (): Promise<{ content: string; type: "TEXT"; attachments?: Array<{ url: string; type: string; filename?: string }> } | null> => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
    });
    const response = result.response;
    const text = response.text();
    if (!text || !text.trim()) return null;

    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as GeminiReplyResult;
    const content = typeof parsed.content === "string" ? parsed.content : "…";
    const responseType = parsed.responseType ?? "text";

    if (responseType === "text" || responseType === "emoji") {
      return { content, type: "TEXT" };
    }

    const entries = getCatalogEntries(mainClass, parsed.attachmentHint);
    const first = entries[0];
    if (first) {
      return {
        content,
        type: "TEXT",
        attachments: [{ url: first.url, type: first.type, filename: first.type === "image" ? "image.png" : undefined }],
      };
    }
    return { content, type: "TEXT" };
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const is429 = (e: unknown) =>
    (e as { status?: number }).status === 429 ||
    String((e as Error).message).includes("429") ||
    String((e as Error).message).includes("Too Many Requests") ||
    String((e as Error).message).includes("quota");

  const getRetryDelayMs = (e: unknown): number => {
    const details = (e as { errorDetails?: Array<{ retryDelay?: string }> }).errorDetails;
    const retryInfo = details?.find((d) => (d as { retryDelay?: string }).retryDelay);
    const delay = retryInfo && typeof (retryInfo as { retryDelay: string }).retryDelay === "string"
      ? parseFloat((retryInfo as { retryDelay: string }).retryDelay.replace(/s$/, "")) * 1000
      : 22_000;
    return Math.min(Math.ceil(delay), 60_000);
  };

  try {
    return await callGemini();
  } catch (err) {
    if (is429(err)) {
      const delayMs = getRetryDelayMs(err);
      console.warn(`Gemini rate limit (429), retrying in ${delayMs / 1000}s...`);
      await sleep(delayMs);
      try {
        return await callGemini();
      } catch (retryErr) {
        console.error("Gemini generateReply still failed after retry (quota/rate limit). Check https://ai.google.dev/gemini-api/docs/rate-limits");
        return null;
      }
    }
    console.error("Gemini generateReply error:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type ActionContentType = "scrap" | "post" | "comment";

/**
 * Generate short in-character content for a random AI action (scrap message, feed/community post, or comment).
 * Returns plain text in Portuguese, one line or short phrase.
 */
export async function generateActionContent(
  mainClass: TF2Class,
  nickname: string,
  actionType: ActionContentType,
  context?: string
): Promise<string> {
  if (!isGeminiConfigured()) {
    return actionType === "scrap"
      ? "Recado em personagem"
      : actionType === "post"
        ? "Post em personagem no feed"
        : "Comentário em personagem";
  }

  const personality = TF2_PERSONALITY_PROMPTS[mainClass] ?? TF2_PERSONALITY_PROMPTS.Scout;
  const typeInstructions =
    actionType === "scrap"
      ? "Write a very short private message (recado) to a friend, one line."
      : actionType === "post"
        ? "Write a very short social post for the feed, one line."
        : "Write a very short comment on a post, one line.";
  const systemPrompt = `You are the ${mainClass} character from Team Fortress 2. ${personality}
Your nickname is ${nickname}. Reply in Portuguese (Brazil) in character. ${typeInstructions}
Respond with ONLY the message text, no quotes, no JSON, no explanation. One line only.`;

  const userPrompt = context
    ? `Context: ${context}\nMessage:`
    : "Message:";

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 120,
    },
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
    });
    const text = result.response.text();
    const trimmed = text?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 500) : "…";
  } catch (err) {
    console.error("Gemini generateActionContent error:", err instanceof Error ? err.message : err);
    return actionType === "scrap" ? "Recado em personagem" : actionType === "post" ? "Post em personagem" : "Comentário.";
  }
}
