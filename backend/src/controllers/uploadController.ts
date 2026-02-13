import type { Request, Response } from "express";
import { z } from "zod";
import {
  getPresignedUploadUrl,
  isR2Configured,
  uploadBufferToPresignedUrl,
  validateContentType,
} from "../services/uploadService.js";

const presignSchema = z.object({
  filename: z.string().min(1, "filename é obrigatório"),
  contentType: z.string().min(1, "contentType é obrigatório"),
  kind: z.enum(["feed", "scrap", "avatar"]),
});

export async function presign(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }

  if (!isR2Configured()) {
    res.status(503).json({ message: "Upload não disponível (R2 não configurado)" });
    return;
  }

  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }

  const { filename, contentType, kind } = parsed.data;

  const allowed = validateContentType(contentType);
  if (!allowed) {
    res.status(400).json({ message: "Tipo de arquivo não permitido" });
    return;
  }
  if (kind === "avatar" && allowed.category !== "image") {
    res.status(400).json({ message: "Foto de perfil deve ser uma imagem (JPEG, PNG, GIF ou WebP)" });
    return;
  }

  try {
    const result = await getPresignedUploadUrl(req.user.id, filename, contentType, kind);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar URL de upload";
    res.status(400).json({ message });
  }
}

/** Upload file via backend (proxy to R2) to avoid CORS. Body = raw file, X-Upload-Filename, ?kind=feed|scrap */
export async function uploadFile(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }

  if (!isR2Configured()) {
    res.status(503).json({ message: "Upload não disponível (R2 não configurado)" });
    return;
  }

  const q = req.query.kind as string;
  const kind = q === "scrap" ? "scrap" : q === "avatar" ? "avatar" : "feed";
  const filename = (req.headers["x-upload-filename"] as string)?.trim() || "file";
  const contentType = (req.headers["content-type"] as string)?.split(";")[0]?.trim() || "application/octet-stream";

  const allowed = validateContentType(contentType);
  if (!allowed) {
    res.status(400).json({ message: "Tipo de arquivo não permitido" });
    return;
  }
  if (kind === "avatar" && allowed.category !== "image") {
    res.status(400).json({ message: "Foto de perfil deve ser uma imagem (JPEG, PNG, GIF ou WebP)" });
    return;
  }

  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    res.status(400).json({ message: "Corpo da requisição deve ser o arquivo binário" });
    return;
  }
  if (buffer.length > allowed.maxBytes) {
    res.status(400).json({ message: "Arquivo excede o tamanho máximo permitido" });
    return;
  }

  try {
    const { uploadUrl, publicUrl, key, type } = await getPresignedUploadUrl(
      req.user.id,
      filename,
      contentType,
      kind
    );
    await uploadBufferToPresignedUrl(uploadUrl, buffer, contentType);
    res.status(200).json({ publicUrl, key, type, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no upload";
    res.status(400).json({ message });
  }
}
