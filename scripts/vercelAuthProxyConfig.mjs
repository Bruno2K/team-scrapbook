import { readFileSync } from "node:fs";

const RAILWAY_AUTH_DESTINATION = "https://dazzling-encouragement-production-fd0f.up.railway.app/auth/:path*";

const REQUIRED_AUTH_HEADERS = {
  "x-vercel-enable-rewrite-caching": "0",
  "Cache-Control": "no-store, private",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export function inspectVercelAuthProxyConfig(vercelJsonPath) {
  const vercel = JSON.parse(readFileSync(vercelJsonPath, "utf8"));
  const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
  const headers = Array.isArray(vercel.headers) ? vercel.headers : [];
  const authRewriteIndex = rewrites.findIndex((rule) => rule.source === "/auth/:path*");
  const spaFallbackIndex = rewrites.findIndex((rule) => rule.source === "/(.*)" && rule.destination === "/index.html");
  const authRewrite = authRewriteIndex >= 0 ? rewrites[authRewriteIndex] : undefined;
  const authHeaderBlock = headers.find((block) => block.source === "/auth/:path*");
  const headerMap = Object.fromEntries(
    (authHeaderBlock?.headers ?? []).map((header) => [header.key, header.value]),
  );
  const missingHeaders = Object.entries(REQUIRED_AUTH_HEADERS)
    .filter(([key, value]) => headerMap[key] !== value)
    .map(([key]) => key);

  const problems = [];
  if (authRewriteIndex < 0) problems.push("missing /auth/:path* rewrite");
  if (spaFallbackIndex < 0) problems.push("missing SPA fallback rewrite");
  if (authRewriteIndex >= 0 && spaFallbackIndex >= 0 && authRewriteIndex >= spaFallbackIndex) {
    problems.push("auth rewrite does not precede SPA fallback");
  }
  if (authRewrite && authRewrite.destination !== RAILWAY_AUTH_DESTINATION) {
    problems.push(`unexpected auth destination: ${authRewrite.destination}`);
  }
  if (missingHeaders.length > 0) {
    problems.push(`missing auth no-cache headers: ${missingHeaders.join(", ")}`);
  }
  if (spaFallbackIndex !== rewrites.length - 1) {
    problems.push("SPA fallback is not the last rewrite");
  }
  const extraAuthRewrites = rewrites.filter((rule) => rule.source.startsWith("/auth") && rule.source !== "/auth/:path*");
  if (extraAuthRewrites.length > 0) problems.push("unexpected extra /auth rewrite");
  if (rewrites.some((rule) => rule.source.includes("socket.io"))) problems.push("socket.io rewrite present");
  const proofEcho = rewrites.find((rule) => rule.source === "/__auth-proxy-proof/echo");
  if (!proofEcho || !String(proofEcho.destination).startsWith("https://httpbingo.org/")) {
    problems.push("missing disposable external echo rewrite");
  }
  if (vercel.buildCommand !== "npm run build") problems.push("buildCommand changed");
  if (vercel.outputDirectory !== "dist") problems.push("outputDirectory changed");
  if (vercel.installCommand !== "npm install") problems.push("installCommand changed");
  if (vercel.framework !== "vite") problems.push("framework changed");

  return {
    ok: problems.length === 0,
    problems,
    authRewriteIndex,
    spaFallbackIndex,
    authDestination: authRewrite?.destination,
    headerMap,
    railwayAuthDestination: RAILWAY_AUTH_DESTINATION,
  };
}
