import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { healthToJSON, readinessToJSON } from "../views/healthView.js";

const READINESS_TTL_MS = 5_000;
let readinessCache: { ready: boolean; expiresAt: number } | undefined;
let readinessProbe: Promise<boolean> | undefined;

async function isDatabaseReady() {
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return readinessCache.ready;

  if (!readinessProbe) {
    readinessProbe = prisma
      .$queryRaw(Prisma.sql`SELECT 1`)
      .then(() => true)
      .catch(() => false)
      .finally(() => { readinessProbe = undefined; });
  }

  const ready = await readinessProbe;
  readinessCache = { ready, expiresAt: Date.now() + READINESS_TTL_MS };
  return ready;
}

export function getHealth(_req: Request, res: Response) {
  res.status(200).json(healthToJSON());
}

export async function getReadiness(_req: Request, res: Response) {
  const ready = await isDatabaseReady();
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json(readinessToJSON(ready ? "ready" : "unavailable"));
}
