import http from "node:http";
import net from "node:net";
import express from "express";
import request from "supertest";
import { Server as SocketServer } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app.js";
import {
  METRIC_LABEL_CONTRACT,
  classifyUnknownFailure,
  correlationMiddleware,
  getCounterValue,
  getGaugeValue,
  getHistogramCount,
  httpObservabilityMiddleware,
  installProcessSignalHandlers,
  listenHttpServer,
  log,
  logStartup,
  metricsHandler,
  normalizeRequestId,
  observeDependency,
  observeSocketPolicyFailure,
  observeSocketRejected,
  renderPrometheus,
  resetLifecycleState,
  resetLogWriter,
  resetMetrics,
  setLogWriter,
  shutdownProcess,
  unhandledErrorMiddleware,
} from "../../src/platform/observability/index.js";
import { runSerializableTransaction } from "../../src/db/transactions.js";

const logs: Record<string, unknown>[] = [];

function captureLogs() {
  logs.length = 0;
  setLogWriter((line) => logs.push(JSON.parse(line) as Record<string, unknown>));
}

describe("observability baseline", () => {
  beforeEach(() => {
    resetMetrics();
    resetLifecycleState();
    captureLogs();
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.stubEnv("RAILWAY_DEPLOYMENT_ID", "railway-dep-1");
  });

  afterEach(() => {
    resetLogWriter();
    resetLifecycleState();
    vi.unstubAllEnvs();
  });

  it("accepts a safe incoming request id and rejects abusive values", () => {
    expect(normalizeRequestId("abc_123.OK-id")).toBe("abc_123.OK-id");
    expect(normalizeRequestId("x".repeat(65))).not.toBe("x".repeat(65));
    expect(normalizeRequestId("id with spaces")).not.toBe("id with spaces");
    expect(normalizeRequestId("id\nwith\nnewlines")).not.toBe("id\nwith\nnewlines");
    expect(normalizeRequestId("ok-id").length).toBeLessThanOrEqual(64);
  });

  it("echoes correlation ids and writes structured request logs without secrets", async () => {
    const app = express();
    app.use(correlationMiddleware);
    app.use(httpObservabilityMiddleware);
    app.get("/feed", (_req, res) => res.status(200).json({ ok: true }));
    app.post("/boom", () => {
      throw new Error("password=super-secret jwt=header.payload.sig");
    });
    app.use(unhandledErrorMiddleware);

    const ok = await request(app)
      .get("/feed")
      .set("X-Request-Id", "corr-123")
      .set("Authorization", "Bearer super-secret-token")
      .set("Cookie", "session=super-secret-token");

    expect(ok.status).toBe(200);
    expect(ok.headers["x-request-id"]).toBe("corr-123");

    const boom = await request(app)
      .post("/boom")
      .set("X-Request-Id", "corr-err")
      .set("Authorization", "Bearer super-secret-token");

    expect(boom.status).toBe(500);
    expect(boom.body).toEqual({ message: "Erro interno", requestId: "corr-err" });
    expect(JSON.stringify(boom.body)).not.toContain("super-secret");

    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("password=super-secret");
    expect(serialized).not.toContain("Authorization");
    expect(logs.some((entry) => entry.event === "http.request" && entry.requestId === "corr-123" && entry.route === "/feed" && entry.status === 200)).toBe(true);
    expect(logs.some((entry) => entry.event === "http.unhandled_error" && entry.requestId === "corr-err" && entry.gitSha === "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" && entry.errorName === "Error")).toBe(true);
    expect(logs.some((entry) => entry.event === "http.error" && entry.requestId === "corr-err" && entry.status === 500)).toBe(true);
  });

  it("records bounded HTTP metrics for success and failure", async () => {
    const app = express();
    app.use(correlationMiddleware);
    app.use(httpObservabilityMiddleware);
    app.get("/items/:id", (_req, res) => res.status(200).json({ ok: true }));
    app.get("/fail", (_req, res) => res.status(500).json({ message: "Erro interno" }));
    app.get("/metrics", metricsHandler);

    await request(app).get("/items/user-a");
    await request(app).get("/items/user-b");
    await request(app).get("/fail");

    expect(getCounterValue("http_requests_total", { method: "GET", route: "/items/:id", status_class: "2xx" })).toBe(2);
    expect(getCounterValue("http_requests_total", { method: "GET", route: "/fail", status_class: "5xx" })).toBe(1);
    expect(getCounterValue("http_request_errors_total", { method: "GET", route: "/fail", status_class: "5xx" })).toBe(1);
    expect(getHistogramCount("http_request_duration_ms", { method: "GET", route: "/items/:id" })).toBe(2);
    expect(getGaugeValue("http_requests_in_flight")).toBe(0);

    const exposition = (await request(app).get("/metrics")).text;
    expect(exposition).toContain("http_requests_total");
    expect(exposition).not.toContain("user-a");
    expect(exposition).not.toContain("user-b");
    expect(exposition).not.toContain("corr-");
    for (const name of METRIC_LABEL_CONTRACT.forbidden_label_names) {
      expect(exposition).not.toContain(`${name}=`);
    }
  });

  it("classifies dependency failures without logging payloads", async () => {
    await expect(observeDependency("gemini", async () => {
      throw new Error("API key AIzaSecretPayload prompt=hello");
    })).rejects.toThrow();

    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("AIzaSecretPayload");
    expect(serialized).not.toContain("prompt=hello");
    expect(logs.some((entry) => entry.event === "dependency.call" && entry.dependency === "gemini" && entry.outcome === "failure" && entry.errorName === "Error")).toBe(true);
    expect(getCounterValue("dependency_requests_total", {
      dependency: "gemini",
      outcome: "failure",
      failure_category: "unknown",
    })).toBe(1);
    expect(classifyUnknownFailure(Object.assign(new Error("quota"), { status: 429 }))).toBe("rate_limited");
  });

  it("records transaction retries and exhausted conflicts", async () => {
    const prisma = await import("../../src/db/client.js");
    const conflict = Object.assign(new Error("write conflict"), { code: "P2034" });
    vi.spyOn(prisma.prisma, "$transaction").mockRejectedValue(conflict);

    await expect(runSerializableTransaction(async () => "ok")).rejects.toMatchObject({ code: "TRANSACTION_CONFLICT" });
    expect(getCounterValue("db_transaction_retries_total")).toBe(3);
    expect(getCounterValue("db_transaction_conflicts_total")).toBe(1);
    expect(JSON.stringify(logs)).not.toContain("write conflict");
  });

  it("records process-local socket policy failures", () => {
    observeSocketRejected("sock-1");
    observeSocketPolicyFailure("sock-1", "message", "FORBIDDEN");
    expect(getCounterValue("socket_connections_rejected_total")).toBe(1);
    expect(getCounterValue("socket_policy_failures_total", { event: "message", code: "FORBIDDEN" })).toBe(1);
    expect(getCounterValue("socket_policy_failures_total", { event: "connection", code: "UNAUTHENTICATED" })).toBe(1);
  });

  it("emits startup identity without secret values", () => {
    vi.stubEnv("JWT_SECRET", "do-not-log-this-secret");
    vi.stubEnv("STEAM_WEB_API_KEY", "steam-secret");
    logStartup();
    const startup = logs.find((entry) => entry.event === "process.startup");
    expect(startup).toMatchObject({
      gitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      deploymentId: "railway-dep-1",
      jwtConfigured: true,
      steamConfigured: true,
    });
    expect(JSON.stringify(startup)).not.toContain("do-not-log-this-secret");
    expect(JSON.stringify(startup)).not.toContain("steam-secret");
    log.info({ event: "manual", password: "nope", token: "nope" } as never);
    expect(JSON.stringify(logs)).not.toContain("nope");
  });

  it("shuts down HTTP, sockets and the database hook within a bound", async () => {
    const httpServer = http.createServer((_req, res) => res.end("ok"));
    const io = {
      close: (cb?: () => void) => cb?.(),
    };
    await listenHttpServer(httpServer, 0);
    const disconnected: string[] = [];
    const result = await shutdownProcess({
      httpServer,
      io: io as never,
      disconnectDatabase: async () => {
        disconnected.push("prisma");
      },
    }, { timeoutMs: 50 });
    expect(result).toBe("completed");
    expect(disconnected).toEqual(["prisma"]);
    expect(logs.some((entry) => entry.event === "process.shutdown.initiated")).toBe(true);
    expect(logs.some((entry) => entry.event === "process.shutdown.completed")).toBe(true);
    expect(await shutdownProcess({
      httpServer,
      io: io as never,
      disconnectDatabase: async () => undefined,
    })).toBe("skipped");
  });

  it("fails shutdown when the timeout elapses", async () => {
    const httpServer = http.createServer();
    await listenHttpServer(httpServer, 0);
    const result = await shutdownProcess({
      httpServer,
      io: { close: (cb?: () => void) => cb?.() } as never,
      disconnectDatabase: () => new Promise(() => undefined),
    }, { timeoutMs: 20, exit: () => undefined });
    expect(result).toBe("timeout");
    expect(logs.some((entry) => entry.event === "process.shutdown.failure")).toBe(true);
  });

  it("closes Socket.io before the HTTP server so live connections do not deadlock shutdown", async () => {
    const order: string[] = [];
    const fakeHttp = {
      closeAllConnections() {
        order.push("closeAllConnections");
      },
      close(cb?: (error?: Error) => void) {
        order.push("http");
        cb?.();
      },
    };
    const fakeIo = {
      close(cb?: () => void) {
        order.push("io");
        cb?.();
      },
    };
    const result = await shutdownProcess({
      httpServer: fakeHttp as never,
      io: fakeIo as never,
      disconnectDatabase: async () => {
        order.push("prisma");
      },
    }, { timeoutMs: 50 });
    expect(result).toBe("completed");
    expect(order[0]).toBe("closeAllConnections");
    expect(order).toContain("io");
    expect(order).toContain("http");
    expect(order.at(-1)).toBe("prisma");
  });

  it("completes shutdown while a TCP connection is still open", async () => {
    const httpServer = http.createServer();
    const io = new SocketServer(httpServer);
    await listenHttpServer(httpServer, 0);
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("missing port");
    const client = net.connect(address.port, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("error", reject);
    });
    const disconnected: string[] = [];
    const result = await shutdownProcess({
      httpServer,
      io,
      disconnectDatabase: async () => {
        disconnected.push("prisma");
      },
    }, { timeoutMs: 1000 });
    client.destroy();
    expect(result).toBe("completed");
    expect(disconnected).toEqual(["prisma"]);
  });

  it("does not convert malformed JSON into a 5xx availability failure", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{not-json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Requisição inválida");
    expect(JSON.stringify(res.body)).not.toContain("SyntaxError");
    expect(getCounterValue("http_request_errors_total", { method: "POST", route: "unmatched", status_class: "5xx" })).toBe(0);
  });

  it("installs signal handlers once and removes them on reset", async () => {
    const httpServer = http.createServer();
    await listenHttpServer(httpServer, 0);
    const before = process.listenerCount("SIGTERM");
    const exits: number[] = [];
    const managed = {
      httpServer,
      io: { close: (cb?: () => void) => cb?.() } as never,
      disconnectDatabase: async () => undefined,
    };
    installProcessSignalHandlers(managed, { timeoutMs: 200, exit: (code) => exits.push(code) });
    installProcessSignalHandlers(managed, { timeoutMs: 200, exit: (code) => exits.push(code) });
    expect(process.listenerCount("SIGTERM")).toBe(before + 1);
    process.emit("SIGTERM");
    await vi.waitFor(() => expect(exits.length).toBe(1));
    resetLifecycleState();
    expect(process.listenerCount("SIGTERM")).toBe(before);
  });
});
