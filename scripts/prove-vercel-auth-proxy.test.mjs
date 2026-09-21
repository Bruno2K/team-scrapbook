import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { proveEchoTransport, proveVercelAuthProxy, startLocalEcho } from "./prove-vercel-auth-proxy.mjs";
import { inspectVercelAuthProxyConfig } from "./vercelAuthProxyConfig.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let echo;

test("vercel.json keeps the auth rewrite ahead of the SPA fallback", () => {
  const inspection = inspectVercelAuthProxyConfig(join(root, "vercel.json"));
  assert.equal(inspection.ok, true, inspection.problems.join("; "));
  assert.equal(inspection.authRewriteIndex, 0);
  assert.ok(inspection.spaFallbackIndex > inspection.authRewriteIndex);
});

test("disposable echo forwards Origin, Cookie, body, Set-Cookie, and 204, and is disabled in Vercel production", async () => {
  echo = await startLocalEcho();
  const result = await proveEchoTransport(echo.url, "https://preview.example.test");
  assert.equal(result.ok, true, result.failures.join("; "));
  assert.equal(result.live.echoLogout.status, 204);

  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const blocked = await startLocalEcho();
    const response = await fetch(blocked.url, { method: "POST", body: "{}" });
    assert.equal(response.status, 404);
    await new Promise((resolve, reject) => blocked.server.close((error) => (error ? reject(error) : resolve())));
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});

test("config-only proof passes without a preview URL", async () => {
  const result = await proveVercelAuthProxy();
  assert.equal(result.ok, true, result.failures.join("; "));
  assert.equal(result.evidence.live.preview, undefined);
});

after(async () => {
  if (echo?.server) {
    await new Promise((resolve, reject) => echo.server.close((error) => (error ? reject(error) : resolve())));
  }
});
