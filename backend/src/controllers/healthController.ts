import type { Request, Response } from "express";
import { isDatabaseReady, isShuttingDown, setReadinessMetric } from "../platform/observability/index.js";
import { healthToJSON, readinessToJSON } from "../views/healthView.js";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json(healthToJSON());
}

export async function getReadiness(_req: Request, res: Response) {
  if (isShuttingDown()) {
    setReadinessMetric(false);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json(readinessToJSON("unavailable"));
    return;
  }
  const ready = await isDatabaseReady();
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json(readinessToJSON(ready ? "ready" : "unavailable"));
}
