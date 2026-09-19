import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { log } from "./logger.js";
import {
  decInFlight,
  incInFlight,
  PROBE_ROUTES,
  recordHttpRequest,
  renderPrometheus,
} from "./metrics.js";

function boundPath(value: string): string {
  return value
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d{6,}/g, "/:id")
    .replace(/\/[A-Za-z0-9_-]{24,}/g, "/:id");
}

export function requestRoute(req: Request): string {
  if (req.route?.path != null) {
    const base = boundPath(req.baseUrl || "");
    const path = req.route.path === "/" ? "" : String(req.route.path);
    const combined = `${base}${path}` || "/";
    return combined;
  }
  return "unmatched";
}

function boundedErrorName(error: unknown): string | undefined {
  const name = error instanceof Error ? error.name : undefined;
  if (name && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(name)) return name;
  return undefined;
}

function boundedErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = String((error as { code: unknown }).code);
  if (/^[A-Za-z0-9._-]{1,32}$/.test(code)) return code;
  return undefined;
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = Number(
    (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode,
  );
  if (status >= 400 && status < 500) return status;
  return undefined;
}

export function httpObservabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  incInFlight();
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    decInFlight();
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const route = requestRoute(req);
    recordHttpRequest({
      method: req.method,
      route,
      status: res.statusCode,
      durationMs,
    });

    const fields = {
      event: res.statusCode >= 500 ? "http.error" : "http.request",
      requestId: req.correlationId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      failureCategory: res.statusCode >= 500 ? "http_5xx" : res.statusCode >= 400 ? "http_4xx" : "none",
    } as const;

    if (PROBE_ROUTES.has(route)) {
      log.debug(fields);
      return;
    }
    if (res.statusCode >= 500) {
      log.error(fields);
      return;
    }
    log.info(fields);
  };

  res.on("finish", finish);
  res.on("close", finish);
  next();
}

export const unhandledErrorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  const clientStatus = clientErrorStatus(error);
  const status = clientStatus ?? 500;
  const fields = {
    event: "http.unhandled_error",
    requestId: req.correlationId,
    method: req.method,
    route: requestRoute(req),
    status,
    failureCategory: status >= 500 ? "unknown" : "http_4xx",
    errorName: boundedErrorName(error),
    errorCode: boundedErrorCode(error),
  };
  if (status >= 500) log.error(fields);
  else log.warn(fields);
  if (res.headersSent) {
    next(error);
    return;
  }
  if (status < 500) {
    res.status(status).json({
      message: "Requisição inválida",
      requestId: req.correlationId,
    });
    return;
  }
  res.status(500).json({
    message: "Erro interno",
    requestId: req.correlationId,
  });
};

export function metricsHandler(_req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(renderPrometheus());
}
