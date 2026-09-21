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
  };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--preview-url") args.previewUrl = argv[index + 1];
    if (current === "--share-url") args.shareUrl = argv[index + 1];
    if (current === "--echo-url") args.echoUrl = argv[index + 1];
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
  return htmlLike(result.body) && (
    result.status === 401
    || result.status === 403
    || /authentication required|vercel.*login|deployment protection/i.test(result.body)
  );
}

function echoModeUrl(echoUrl, mode) {
  const url = new URL(echoUrl);
  url.searchParams.set("mode", mode);
  return url.toString();
}

export async function proveEchoTransport(echoUrl, origin = "https://preview.example.test") {
  const failures = [];
  const cookie = "refresh_token=synthetic-preview-proof";
  const live = {};

  const echoLogin = await fetchProof(echoModeUrl(echoUrl, "login"), {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
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
  assert(echoJson.cookie === cookie, `echo cookie ${echoJson.cookie}`, failures);
  assert(echoJson.body?.probe === "login-body", "echo POST body was not forwarded", failures);
  assert(
    echoLogin.setCookie.some((value) => value.startsWith("refresh_token=")),
    "echo Set-Cookie missing refresh_token",
    failures,
  );
  assert(echoLogin.setCookie.some((value) => /HttpOnly/i.test(value)), "echo Set-Cookie missing HttpOnly", failures);
  assert(echoLogin.setCookie.some((value) => /SameSite=Lax/i.test(value)), "echo Set-Cookie missing SameSite=Lax", failures);
  assert(echoLogin.setCookie.some((value) => /Path=\/auth/i.test(value)), "echo Set-Cookie missing Path=/auth", failures);
  assert(echoLogin.setCookie.every((value) => !/Domain=/i.test(value)), "echo Set-Cookie unexpectedly set Domain", failures);
  assert(!/HIT/i.test(echoLogin.cache), `echo login was a CDN HIT (${echoLogin.cache})`, failures);

  const echoRefresh = await fetchProof(echoModeUrl(echoUrl, "refresh"), {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
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
  assert(refreshJson.cookie === cookie, "echo refresh Cookie was not forwarded", failures);
  assert(refreshJson.origin === origin, "echo refresh Origin was not forwarded", failures);

  const echoLogout = await fetchProof(echoModeUrl(echoUrl, "logout"), {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
    },
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
    echoLogout.setCookie.some((value) => /refresh_token=;/i.test(value) || /Max-Age=0/i.test(value)),
    "echo logout did not clear Set-Cookie",
    failures,
  );

  return { ok: failures.length === 0, failures, live };
}

export async function provePreviewAuthRewrite(previewUrl) {
  const failures = [];
  const live = {};
  const base = previewUrl.replace(/\/+$/, "");
  const origin = new URL(base).origin;
  const cookie = "refresh_token=synthetic-preview-proof";

  const spa = await fetchProof(`${base}/auth/refresh`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
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
    protected: looksProtected(spa),
    bodyPreview: spa.body.slice(0, 180),
  };
  if (looksProtected(spa)) {
    failures.push("Vercel Deployment Protection intercepted /auth/refresh; use an authenticated preview or share URL");
    return { ok: false, failures, live };
  }
  assert(!htmlLike(spa.body), "/auth/refresh returned SPA HTML", failures);
  assert(!/index\.html/i.test(spa.body), "/auth/refresh looked like the SPA fallback", failures);
  assert(spa.status !== 200 || !spa.contentType.includes("text/html"), "/auth/refresh status/content-type looks like SPA", failures);

  const loginBody = { nickname: "issue-44-proxy-proof-invalid", password: "not-a-real-password" };
  const login = await fetchProof(`${base}/auth/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
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
    bodyPreview: login.body.slice(0, 180),
  };
  assert(!htmlLike(login.body), "/auth/login returned SPA HTML", failures);
  assert(
    login.body.includes("inválid") || login.body.includes("invalid") || login.status === 401 || login.status === 400,
    "/auth/login POST body did not appear to reach an auth handler",
    failures,
  );

  const loginAgain = await fetchProof(`${base}/auth/login`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
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

  return { ok: failures.length === 0, failures, live };
}

export async function proveVercelAuthProxy({ previewUrl, shareUrl, echoUrl } = {}) {
  const inspection = inspectVercelAuthProxyConfig(join(root, "vercel.json"));
  const failures = inspection.problems.map((problem) => `config: ${problem}`);
  const evidence = { config: inspection, live: {} };

  if (echoUrl) {
    const echo = await proveEchoTransport(echoUrl, previewUrl ? new URL(previewUrl).origin : "https://preview.example.test");
    evidence.live.echo = echo.live;
    failures.push(...echo.failures.map((item) => `echo: ${item}`));
  }

  if (previewUrl) {
    const rewrite = await provePreviewAuthRewrite(previewUrl);
    evidence.live.preview = rewrite.live;
    failures.push(...rewrite.failures.map((item) => `preview: ${item}`));
    if (!echoUrl) {
      const echo = await proveEchoTransport(`${previewUrl.replace(/\/+$/, "")}/api/auth-proxy-echo`, new URL(previewUrl).origin);
      evidence.live.echo = echo.live;
      failures.push(...echo.failures.map((item) => `echo: ${item}`));
    }
  }

  evidence.previewUrl = previewUrl ?? null;
  evidence.shareUrl = shareUrl ?? null;
  evidence.note = [
    "Live /auth/* checks use the committed Railway rewrite and must not create production sessions.",
    "Invalid login credentials and synthetic cookies only.",
    "Cookie/Set-Cookie/Origin attribute proof uses the disposable auth-proxy-echo upstream, not production login.",
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
