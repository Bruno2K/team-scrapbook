#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const APP_MARKER = "team-scrapbook-frontend";
const SERVICE_NAME = "team-scrapbook-api";
const DEFAULT_TIMEOUT_MS = 10_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedBaseUrl(value, label) {
  const url = new URL(value);
  invariant(url.protocol === "http:" || url.protocol === "https:", `${label} must use http or https`);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((entry) => [entry[1].toLowerCase(), entry[2]]),
    );
    if (attributes.name === name) return attributes.content ?? "";
  }
  return null;
}

function moduleEntrySource(html) {
  for (const match of html.matchAll(/<script\s+[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((entry) => [entry[1].toLowerCase(), entry[2]]),
    );
    if (attributes.type === "module" && attributes.src) return attributes.src;
  }
  return null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(`request failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchJson(url, options, timeoutMs) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return JSON`);
  }
  return { response, body };
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export async function runSmoke({ frontendUrl, backendUrl, environment, expectedSha, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const frontend = normalizedBaseUrl(frontendUrl, "frontend URL");
  const backend = normalizedBaseUrl(backendUrl, "backend URL");
  invariant(environment?.trim(), "environment name is required");

  const frontendResponse = await fetchWithTimeout(frontend, { redirect: "follow" }, timeoutMs);
  invariant(frontendResponse.ok, `frontend returned HTTP ${frontendResponse.status}`);
  invariant(frontendResponse.headers.get("content-type")?.includes("text/html"), "frontend did not return HTML");
  const html = await frontendResponse.text();
  invariant(metaContent(html, "team-scrapbook-app") === APP_MARKER, "frontend application fingerprint is missing or incorrect");
  const moduleSource = moduleEntrySource(html);
  invariant(moduleSource, "frontend module entry is missing");
  const moduleUrl = new URL(moduleSource, `${frontend}/`);
  invariant(moduleUrl.origin === new URL(frontend).origin, "frontend module entry must be served from the frontend origin");
  const moduleResponse = await fetchWithTimeout(moduleUrl, { redirect: "follow" }, timeoutMs);
  invariant(moduleResponse.ok, `frontend module entry returned HTTP ${moduleResponse.status}`);
  invariant(new URL(moduleResponse.url).origin === new URL(frontend).origin, "frontend module entry redirected away from the frontend origin");
  invariant(moduleResponse.headers.get("content-type")?.includes("javascript"), "frontend module entry is not JavaScript");

  const configuredApi = metaContent(html, "team-scrapbook-api-base");
  invariant(configuredApi, "frontend did not publish its configured API base URL");
  invariant(normalizedBaseUrl(configuredApi, "published frontend API URL") === backend, "frontend API configuration does not match the smoke backend URL");

  const origin = new URL(frontend).origin;
  const processHealth = await fetchJson(`${backend}/health`, { headers: { Origin: origin } }, timeoutMs);
  invariant(processHealth.response.ok, `backend process health returned HTTP ${processHealth.response.status}`);
  invariant(processHealth.body?.status === "ok" && processHealth.body?.service === SERVICE_NAME, "backend process health payload is invalid");
  invariant(validTimestamp(processHealth.body?.timestamp), "backend process health timestamp is invalid");
  const allowedOrigin = processHealth.response.headers.get("access-control-allow-origin");
  invariant(allowedOrigin === origin || allowedOrigin === "*", `backend CORS does not allow frontend origin ${origin}`);

  const readiness = await fetchJson(`${backend}/health/ready`, { headers: { Origin: origin } }, timeoutMs);
  invariant(readiness.response.ok, `database readiness returned HTTP ${readiness.response.status}`);
  invariant(
    readiness.body?.status === "ready" && readiness.body?.service === SERVICE_NAME && readiness.body?.checks?.database === "ready",
    "database readiness payload is invalid",
  );
  invariant(validTimestamp(readiness.body?.timestamp), "database readiness timestamp is invalid");

  const frontendSha = metaContent(html, "team-scrapbook-git-sha");
  const frontendDeploymentId = metaContent(html, "team-scrapbook-deployment-id");
  const backendSha = processHealth.body?.release?.gitSha ?? null;
  const backendDeploymentId = processHealth.body?.release?.deploymentId ?? null;
  if (expectedSha) {
    invariant(/^[0-9a-f]{40}$/i.test(expectedSha), "expected SHA must be a full 40-character Git SHA");
    invariant(frontendSha === expectedSha, `frontend SHA ${frontendSha ?? "missing"} does not match expected SHA ${expectedSha}`);
    invariant(backendSha === expectedSha, `backend SHA ${backendSha ?? "missing"} does not match expected SHA ${expectedSha}`);
  }

  return {
    status: "pass",
    environment,
    frontend: { url: frontend, gitSha: frontendSha, deploymentId: frontendDeploymentId },
    backend: { url: backend, process: "ok", database: "ready", gitSha: backendSha, deploymentId: backendDeploymentId },
    expectedSha: expectedSha || null,
  };
}

export function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    invariant(key?.startsWith("--") && value !== undefined, `invalid argument near ${key ?? "end of command"}`);
    values[key.slice(2)] = value;
  }
  return {
    frontendUrl: values["frontend-url"],
    backendUrl: values["backend-url"],
    environment: values.environment,
    expectedSha: values["expected-sha"] || undefined,
  };
}

async function main() {
  try {
    const result = await runSmoke(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
