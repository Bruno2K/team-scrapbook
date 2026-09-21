import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import handler from "../api/auth-proxy-echo.js";
import { inspectVercelAuthProxyConfig } from "./vercelAuthProxyConfig.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function htmlLike(body) {
  return /^\s*</.test(body) || /<html[\s>]/i.test(body);
}

function header(headers, name) {
  const value = headers.get(name);
  return value ?? headers.get(name.toLowerCase());
}

function setCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function parsePreviewArgs(argv) {
  const args = {
    previewUrl: process.env.AUTH_PROXY_PROOF_URL,
    shareUrl: process.env.AUTH_PROXY_PROOF_SHARE_URL,
    echoUrl: process.env.AUTH_PROXY_ECHO_URL,
    cookie: process.env.AUTH_PROXY_PROOF_COOKIE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--preview-url") args.previewUrl = argv[index + 1];
    if (current === "--share-url") args.shareUrl = argv[index + 1];
    if (current === "--echo-url") args.echoUrl = argv[index + 1];
    if (current === "--cookie") args.cookie = argv[index + 1];
  }
  return args;
}

async function fetchProof(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body,
    contentType: header(response.headers, "content-type") ?? "",
    cache: header(response.headers, "x-vercel-cache") ?? header(response.headers, "X-Vercel-Cache") ?? "",
    cacheControl: header(response.headers, "cache-control") ?? "",
    setCookie: setCookieHeaders(response.headers),
  };
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function looksProtected(result) {
  const body = result.body ?? "";
  if (/Protected deployment/i.test(body)) return true;
  return htmlLike(body) && (
    result.status === 401
    || result.status === 403
    || /authentication required|vercel.*login|deployment protection/i.test(body)
  );
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0];
  return value ?? null;
}

function isSpaDocument(body) {
  return /team-scrapbook-app|team-scrapbook-frontend/i.test(body);
}

function echoModeUrl(echoUrl, mode) {
  const url = new URL(echoUrl);
  url.searchParams.set("mode", mode);
  return url.toString();
}

function mergeCookie(left, right) {
  return [left, right].filter(Boolean).join("; ");
}

export async function proveEchoTransport(echoUrl, origin = "https://preview.example.test", extraHeaders = {}) {
  const failures = [];
  const cookie = "refresh_token=synthetic-preview-proof";
  const live = {};
  const requestHeaders = {
    Origin: origin,
    "Content-Type": "application/json",
    ...extraHeaders,
    Cookie: mergeCookie(extraHeaders.Cookie, cookie),
  };
  const echoLogin = await fetchProof(echoModeUrl(echoUrl, "login"), {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ probe: "login-body" }),
    redirect: "manual",
  });
  let echoJson = {};
  try {
    echoJson = JSON.parse(echoLogin.body);
  } catch {
    echoJson = {};
  }
  live.echoLogin = {
    status: echoLogin.status,
    contentType: echoLogin.contentType,
    cache: echoLogin.cache,
    cacheControl: echoLogin.cacheControl,
    setCookie: echoLogin.setCookie,
    origin: echoJson.origin ?? null,
    cookie: echoJson.cookie ?? null,
    body: echoJson.body ?? null,
    html: htmlLike(echoLogin.body),
  };
  assert(echoLogin.status === 200, `echo login status ${echoLogin.status}`, failures);
  assert(echoLogin.contentType.includes("application/json"), `echo login content-type ${echoLogin.contentType}`, failures);
  assert(echoJson.origin === origin, `echo origin ${echoJson.origin} !== ${origin}`, failures);
  assert(String(echoJson.cookie ?? "").includes(cookie), `echo cookie ${echoJson.cookie}`, failures);
  assert(echoJson.body?.probe === "login-body", "echo POST body was not forwarded", failures);
  assert(
    echoLogin.setCookie.some((value) => value.startsWith("auth_proxy_proof=")),
    "echo Set-Cookie missing auth_proxy_proof",
    failures,
  );
  assert(echoLogin.setCookie.some((value) => /HttpOnly/i.test(value)), "echo Set-Cookie missing HttpOnly", failures);
  assert(echoLogin.setCookie.some((value) => /SameSite=Lax/i.test(value)), "echo Set-Cookie missing SameSite=Lax", failures);
  assert(echoLogin.setCookie.some((value) => /Path=\/auth/i.test(value)), "echo Set-Cookie missing Path=/auth", failures);
  assert(echoLogin.setCookie.every((value) => !/Domain=/i.test(value)), "echo Set-Cookie unexpectedly set Domain", failures);
  assert(!/HIT/i.test(echoLogin.cache), `echo login was a CDN HIT (${echoLogin.cache})`, failures);

  const echoRefresh = await fetchProof(echoModeUrl(echoUrl, "refresh"), {
    method: "POST",
    headers: requestHeaders,
    body: "{}",
    redirect: "manual",
  });
  let refreshJson = {};
  try {
    refreshJson = JSON.parse(echoRefresh.body);
  } catch {
    refreshJson = {};
  }
  live.echoRefresh = {
    status: echoRefresh.status,
    origin: refreshJson.origin ?? null,
    cookie: refreshJson.cookie ?? null,
  };
  assert(String(refreshJson.cookie ?? "").includes(cookie), "echo refresh Cookie was not forwarded", failures);
  assert(refreshJson.origin === origin, "echo refresh Origin was not forwarded", failures);

  const echoLogout = await fetchProof(echoModeUrl(echoUrl, "logout"), {
    method: "POST",
    headers: requestHeaders,
    redirect: "manual",
  });
  live.echoLogout = {
    status: echoLogout.status,
    setCookie: echoLogout.setCookie,
    contentType: echoLogout.contentType,
    bodyLength: echoLogout.body.length,
  };
  assert(echoLogout.status === 204, `echo logout status ${echoLogout.status}`, failures);
  assert(
    echoLogout.setCookie.some((value) => /auth_proxy_proof=;/i.test(value) || /Max-Age=0/i.test(value)),
    "echo logout did not clear Set-Cookie",
    failures,
  );

  return { ok: failures.length === 0, failures, live };
}

export async function provePreviewAuthRewrite(previewUrl, extraHeaders = {}) {
  const failures = [];
  const live = {};
  const base = previewUrl.replace(/\/+$/, "");
  const origin = new URL(base).origin;
  const cookie = "refresh_token=synthetic-preview-proof";
  const headers = { ...extraHeaders };

  const spa = await fetchProof(`${base}/auth/refresh`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...headers,
      Cookie: mergeCookie(headers.Cookie, cookie),
    },
    body: "{}",
    redirect: "manual",
  });
  live.authRefresh = {
    status: spa.status,
    contentType: spa.contentType,
    cache: spa.cache,
    cacheControl: spa.cacheControl,
    html: htmlLike(spa.body),
    spa: isSpaDocument(spa.body),
    protected: looksProtected(spa),
    bodyPreview: spa.body.slice(0, 180),
  };
  if (looksProtected(spa)) {
    failures.push("Vercel Deployment Protection intercepted /auth/refresh; use an authenticated preview or share URL");
    return { ok: false, failures, live };
  }
  assert(!isSpaDocument(spa.body), "/auth/refresh returned the SPA document", failures);
  const refreshReachedUpstream = spa.status === 401 || spa.status === 403 || spa.status === 404 || /Cannot POST \/auth\/refresh/i.test(spa.body);
  assert(refreshReachedUpstream, "/auth/refresh did not reach an upstream auth handler", failures);

  const loginBody = { nickname: "issue-44-proxy-proof-invalid", password: "not-a-real-password" };
  const login = await fetchProof(`${base}/auth/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(loginBody),
    redirect: "manual",
  });
  live.authLoginInvalid = {
    status: login.status,
    contentType: login.contentType,
    cache: login.cache,
    cacheControl: login.cacheControl,
    html: htmlLike(login.body),
    spa: isSpaDocument(login.body),
    bodyPreview: login.body.slice(0, 180),
  };
  assert(!isSpaDocument(login.body), "/auth/login returned the SPA document", failures);
  assert(!looksProtected(login), "Vercel Deployment Protection intercepted /auth/login", failures);
  assert(
    /inv[aá]lid/i.test(login.body) && login.status === 401,
    "/auth/login POST body did not reach Railway login",
    failures,
  );

  const loginAgain = await fetchProof(`${base}/auth/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(loginBody),
    redirect: "manual",
  });
  live.authLoginRepeat = {
    status: loginAgain.status,
    cache: loginAgain.cache,
    cacheControl: loginAgain.cacheControl,
  };
  assert(!/HIT/i.test(login.cache), `first /auth/login was a CDN HIT (${login.cache})`, failures);
  assert(!/HIT/i.test(loginAgain.cache), `repeated /auth/login was a CDN HIT (${loginAgain.cache})`, failures);

  const unknown = await fetchProof(`${base}/this-is-not-a-real-route`, {
    method: "GET",
    headers,
    redirect: "manual",
  });
  live.spaFallback = { status: unknown.status, spa: isSpaDocument(unknown.body) };
  assert(isSpaDocument(unknown.body), "unknown path did not fall through to the SPA", failures);

  return { ok: failures.length === 0, failures, live };
}

export async function proveExternalRewrite(previewUrl, extraHeaders = {}) {
  const failures = [];
  const live = {};
  const base = previewUrl.replace(/\/+$/, "");
  const origin = new URL(base).origin;
  const cookie = "refresh_token=synthetic-preview-proof";
  const proofHeaders = {
    Origin: origin,
    "Content-Type": "application/json",
    "x-team-scrapbook-auth-proxy-proof": "1",
    ...extraHeaders,
    Cookie: mergeCookie(extraHeaders.Cookie, cookie),
  };

  const echo = await fetchProof(`${base}/__auth-proxy-proof/echo`, {
    method: "POST",
    headers: proofHeaders,
    body: JSON.stringify({ probe: "login-body" }),
    redirect: "manual",
  });
  let echoJson = {};
  try {
    echoJson = JSON.parse(echo.body);
  } catch {
    echoJson = {};
  }
  const echoedHeaders = echoJson.headers ?? {};
  const echoedOrigin = headerValue(echoedHeaders.Origin ?? echoedHeaders.origin);
  const echoedCookie = headerValue(echoedHeaders.Cookie ?? echoedHeaders.cookie);
  live.externalEcho = {
    status: echo.status,
    contentType: echo.contentType,
    cache: echo.cache,
    origin: echoedOrigin,
    cookieForwarded: String(echoedCookie ?? "").includes("refresh_token=synthetic-preview-proof"),
    json: echoJson.json ?? null,
    spa: isSpaDocument(echo.body),
    protected: looksProtected(echo),
  };
  if (looksProtected(echo)) {
    failures.push("Vercel Deployment Protection intercepted /__auth-proxy-proof/echo");
    return { ok: false, failures, live };
  }
  assert(!isSpaDocument(echo.body), "external echo fell through to the SPA", failures);
  assert(echo.status === 200, `external echo status ${echo.status}`, failures);
  assert(
    echoedOrigin === origin,
    `external rewrite Origin ${echoedOrigin} !== ${origin}`,
    failures,
  );
  assert(
    String(echoedCookie ?? "").includes(cookie),
    "external rewrite Cookie was not forwarded",
    failures,
  );
  assert(echoJson.json?.probe === "login-body", "external rewrite POST body was not forwarded", failures);
  assert(!/HIT/i.test(echo.cache), `external echo was a CDN HIT (${echo.cache})`, failures);

  const setCookie = await fetchProof(`${base}/__auth-proxy-proof/set-cookie`, {
    method: "GET",
    headers: proofHeaders,
    redirect: "manual",
  });
  live.externalSetCookie = {
    status: setCookie.status,
    setCookie: setCookie.setCookie,
    cache: setCookie.cache,
  };
  assert(
    setCookie.setCookie.some((value) => /auth_proxy_proof=/i.test(value)),
    "external rewrite Set-Cookie missing auth_proxy_proof",
    failures,
  );
  assert(setCookie.setCookie.some((value) => /HttpOnly/i.test(value)), "external rewrite Set-Cookie missing HttpOnly", failures);
  assert(setCookie.setCookie.some((value) => /SameSite=Lax/i.test(value)), "external rewrite Set-Cookie missing SameSite=Lax", failures);
  assert(setCookie.setCookie.some((value) => /Path=\/auth/i.test(value)), "external rewrite Set-Cookie missing Path=/auth", failures);
  assert(setCookie.setCookie.every((value) => !/Domain=/i.test(value)), "external rewrite Set-Cookie unexpectedly set Domain", failures);

  const noContent = await fetchProof(`${base}/__auth-proxy-proof/no-content`, {
    method: "GET",
    headers: proofHeaders,
    redirect: "manual",
  });
  live.externalNoContent = {
    status: noContent.status,
    setCookie: noContent.setCookie,
    cache: noContent.cache,
  };
  assert(noContent.status === 204, `external rewrite 204 became ${noContent.status}`, failures);

  return { ok: failures.length === 0, failures, live };
}

export async function proveVercelAuthProxy({ previewUrl, shareUrl, echoUrl, cookie } = {}) {
  const inspection = inspectVercelAuthProxyConfig(join(root, "vercel.json"));
  const failures = inspection.problems.map((problem) => `config: ${problem}`);
  const evidence = { config: inspection, live: {} };
  const extraHeaders = cookie ? { Cookie: cookie } : {};

  if (echoUrl) {
    const echo = await proveEchoTransport(echoUrl, previewUrl ? new URL(previewUrl).origin : "https://preview.example.test");
    evidence.live.echo = echo.live;
    failures.push(...echo.failures.map((item) => `echo: ${item}`));
  }

  if (previewUrl) {
    const rewrite = await provePreviewAuthRewrite(previewUrl, extraHeaders);
    evidence.live.preview = rewrite.live;
    failures.push(...rewrite.failures.map((item) => `preview: ${item}`));
    const external = await proveExternalRewrite(previewUrl, extraHeaders);
    evidence.live.external = external.live;
    failures.push(...external.failures.map((item) => `external: ${item}`));
    if (!echoUrl) {
      const echo = await proveEchoTransport(`${previewUrl.replace(/\/+$/, "")}/api/auth-proxy-echo`, new URL(previewUrl).origin, extraHeaders);
      evidence.live.echo = echo.live;
      failures.push(...echo.failures.map((item) => `echo: ${item}`));
    }
  }

  evidence.previewUrl = previewUrl ?? null;
  evidence.shareUrl = shareUrl ?? null;
  evidence.note = [
    "Live /auth/* checks use the committed Railway rewrite and must not create production sessions.",
    "Invalid login credentials and synthetic cookies only.",
    "Cookie/Set-Cookie/Origin forwarding through Vercel external rewrites is proven on header-gated /__auth-proxy-proof/* to httpbingo, not by creating production sessions.",
  ];
  return { ok: failures.length === 0, failures, evidence };
}

export function startLocalEcho(port = 0) {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      handler(request, response);
    });
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = parsePreviewArgs(process.argv.slice(2));
  const result = await proveVercelAuthProxy(args);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
