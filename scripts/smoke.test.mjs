import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runSmoke } from "./smoke.mjs";

let frontendServer;
let backendServer;
let frontendUrl;
let backendUrl;
let backendMode = "healthy";
const testSha = "0123456789abcdef0123456789abcdef01234567";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function runCli(arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("./smoke.mjs", import.meta.url)), ...arguments_], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

before(async () => {
  backendServer = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("access-control-allow-origin", new URL(frontendUrl).origin);
    if (request.url === "/health") {
      if (backendMode === "process-unhealthy") response.statusCode = 503;
      response.end(JSON.stringify({
        status: backendMode === "process-unhealthy" ? "unavailable" : "ok",
        service: "team-scrapbook-api",
        timestamp: new Date().toISOString(),
        release: { gitSha: testSha, deploymentId: "backend-deployment" },
      }));
      return;
    }
    if (request.url === "/health/ready") {
      if (backendMode === "database-unavailable") response.statusCode = 503;
      response.end(JSON.stringify({
        status: backendMode === "database-unavailable" ? "unavailable" : "ready",
        service: "team-scrapbook-api",
        timestamp: new Date().toISOString(),
        checks: { database: backendMode === "database-unavailable" ? "unavailable" : "ready" },
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ status: "missing" }));
  });
  await listen(backendServer);
  backendUrl = `http://127.0.0.1:${backendServer.address().port}`;

  frontendServer = createServer((request, response) => {
    if (request.url === "/assets/app.js") {
      response.setHeader("content-type", "application/javascript");
      response.end("document.querySelector('#root').textContent = 'ready';");
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><head>
      <meta name="team-scrapbook-app" content="team-scrapbook-frontend">
      <meta name="team-scrapbook-api-base" content="${backendUrl}">
      <meta name="team-scrapbook-git-sha" content="${testSha}">
      <meta name="team-scrapbook-deployment-id" content="frontend-deployment">
    </head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`);
  });
  await listen(frontendServer);
  frontendUrl = `http://127.0.0.1:${frontendServer.address().port}`;
});

after(async () => {
  await Promise.all([close(frontendServer), close(backendServer)]);
});

test("healthy frontend, backend, configuration, and database readiness pass", async () => {
  const result = await runSmoke({ frontendUrl, backendUrl, environment: "test", expectedSha: testSha });
  assert.equal(result.status, "pass");
  assert.equal(result.backend.database, "ready");
});

test("an invalid backend target makes the executable exit non-zero", async () => {
  const result = await runCli([
    "--frontend-url", frontendUrl,
    "--backend-url", `${backendUrl}/invalid`,
    "--environment", "controlled-failure",
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /SMOKE FAILED: frontend API configuration does not match/);
  assert.equal(result.stdout, "");
});

test("unhealthy backend process fails", async () => {
  backendMode = "process-unhealthy";
  try {
    await assert.rejects(
      runSmoke({ frontendUrl, backendUrl, environment: "test" }),
      /backend process health returned HTTP 503/,
    );
  } finally {
    backendMode = "healthy";
  }
});

test("unavailable database readiness fails", async () => {
  backendMode = "database-unavailable";
  try {
    await assert.rejects(
      runSmoke({ frontendUrl, backendUrl, environment: "test" }),
      /database readiness returned HTTP 503/,
    );
  } finally {
    backendMode = "healthy";
  }
});
