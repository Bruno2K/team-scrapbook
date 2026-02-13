import type { Attachment, AttachmentType } from "@/lib/types";
import { apiRequest, getAuthToken, isApiConfigured } from "./client";

export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  type: AttachmentType;
}

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  kind: "feed" | "scrap"
): Promise<PresignResponse> {
  return apiRequest<PresignResponse>("/upload/presign", {
    method: "POST",
    body: JSON.stringify({ filename, contentType, kind }),
  });
}

export interface UploadFileResponse {
  publicUrl: string;
  key: string;
  type: AttachmentType;
  filename: string;
}

/** Upload via backend proxy (avoids CORS with R2). */
export async function uploadFileToR2(file: File, kind: "feed" | "scrap"): Promise<Attachment> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada");
  }
  const baseURL = (import.meta.env.VITE_API_URL as string) ?? "";
  const url = `${baseURL.replace(/\/$/, "")}/upload/file?kind=${kind}`;
  const token = getAuthToken();
  const headers: HeadersInit = {
    "X-Upload-Filename": file.name,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, {
    method: "POST",
    body: file,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const json = JSON.parse(body) as { message?: string };
      message = json.message ?? body;
    } catch {
      // use body as message
    }
    throw new Error(message || `Falha no upload: ${res.status}`);
  }
  const data = (await res.json()) as UploadFileResponse;
  return { url: data.publicUrl, type: data.type, filename: data.filename };
}
