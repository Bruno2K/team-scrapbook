import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
/** R2_BUCKET must be only the bucket name (e.g. "scrapbook"), not a URL */
const bucketRaw = process.env.R2_BUCKET ?? "";
const bucket = bucketRaw.includes("/") ? bucketRaw.replace(/\/+$/, "").split("/").pop() ?? bucketRaw : bucketRaw;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? "";

const MB = 1024 * 1024;
const MAX_SIZE_IMAGE = 10 * MB;
const MAX_SIZE_VIDEO = 50 * MB;
const MAX_SIZE_AUDIO = 20 * MB;
const MAX_SIZE_DOCUMENT = 20 * MB;

const ALLOWED_TYPES: Record<string, { category: "image" | "video" | "audio" | "document"; maxBytes: number }> = {
  "image/jpeg": { category: "image", maxBytes: MAX_SIZE_IMAGE },
  "image/png": { category: "image", maxBytes: MAX_SIZE_IMAGE },
  "image/gif": { category: "image", maxBytes: MAX_SIZE_IMAGE },
  "image/webp": { category: "image", maxBytes: MAX_SIZE_IMAGE },
  "video/mp4": { category: "video", maxBytes: MAX_SIZE_VIDEO },
  "video/webm": { category: "video", maxBytes: MAX_SIZE_VIDEO },
  "audio/mpeg": { category: "audio", maxBytes: MAX_SIZE_AUDIO },
  "audio/mp3": { category: "audio", maxBytes: MAX_SIZE_AUDIO },
  "audio/wav": { category: "audio", maxBytes: MAX_SIZE_AUDIO },
  "audio/webm": { category: "audio", maxBytes: MAX_SIZE_AUDIO },
  "audio/ogg": { category: "audio", maxBytes: MAX_SIZE_AUDIO },
  "application/pdf": { category: "document", maxBytes: MAX_SIZE_DOCUMENT },
};

function getExtension(filename: string): string {
  const last = filename.split("/").pop() ?? filename;
  const idx = last.lastIndexOf(".");
  return idx >= 0 ? last.slice(idx) : "";
}

function contentTypeToExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
  };
  return map[contentType] ?? "";
}

export type AttachmentKind = "feed" | "scrap" | "avatar";

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  type: "image" | "video" | "audio" | "document";
}

export function isR2Configured(): boolean {
  return !!(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl);
}

export function validateContentType(contentType: string): { category: "image" | "video" | "audio" | "document"; maxBytes: number } | null {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  return ALLOWED_TYPES[normalized] ?? null;
}

export async function getPresignedUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
  kind: AttachmentKind
): Promise<PresignResult> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured");
  }

  const allowed = validateContentType(contentType);
  if (!allowed) {
    throw new Error(`Tipo de arquivo não permitido: ${contentType}`);
  }

  const ext = getExtension(filename) || contentTypeToExtension(contentType) || "";
  const date = new Date().toISOString().slice(0, 10);
  const key =
    kind === "avatar"
      ? `avatar/${userId}/${randomUUID()}${ext}`
      : `${kind}/${userId}/${date}/${randomUUID()}${ext}`;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: bucket!,
    Key: key,
    ContentType: contentType,
  });

  const expiresIn = 3600;
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  const publicUrl = publicBaseUrl.endsWith("/") ? `${publicBaseUrl}${key}` : `${publicBaseUrl}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    type: allowed.category,
  };
}

/** Upload buffer to R2 using presigned URL (server-side, avoids CORS). */
export async function uploadBufferToPresignedUrl(
  uploadUrl: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: buffer,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }
}
