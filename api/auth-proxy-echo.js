/**
 * Disposable auth-proxy echo for Issue #44 transport proof.
 * It never talks to Railway or creates RefreshSession rows.
 */
const PROOF_COOKIE_NAME = "auth_proxy_proof";
const PROOF_COOKIE_VALUE = "vercel-auth-proxy-proof";
const PROOF_COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/auth";

function readJsonBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({ raw: "", json: null });
        return;
      }
      try {
        resolve({ raw, json: JSON.parse(raw) });
      } catch {
        resolve({ raw, json: null });
      }
    });
  });
}

function proofSetCookie() {
  return `${PROOF_COOKIE_NAME}=${PROOF_COOKIE_VALUE}; ${PROOF_COOKIE_ATTRS}`;
}

function proofClearCookie() {
  return `${PROOF_COOKIE_NAME}=; ${PROOF_COOKIE_ATTRS}; Max-Age=0`;
}

function requestUrl(request) {
  return new URL(request.url ?? "/", "http://localhost");
}

function sanitizedCookie(cookie) {
  if (!cookie) return null;
  const kept = cookie.split(";").map((part) => part.trim()).filter((part) => part && !/^_vercel/i.test(part));
  return kept.length > 0 ? kept.join("; ") : null;
}

function modeOf(request) {
  const url = requestUrl(request);
  const queryMode = url.searchParams.get("mode");
  if (queryMode) return queryMode.replace(/^\//, "");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const suffix = pathname.split("/").pop();
  return suffix === "auth-proxy-echo" ? "login" : suffix;
}

export default async function handler(request, response) {
  if (process.env.VERCEL_ENV === "production") {
    response.statusCode = 404;
    response.end();
    return;
  }

  response.setHeader("Cache-Control", "no-store, private");
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store");
  response.setHeader("x-vercel-enable-rewrite-caching", "0");

  const mode = modeOf(request);
  const body = request.method === "GET" || request.method === "HEAD"
    ? { raw: "", json: null }
    : await readJsonBody(request);
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
  const cookie = sanitizedCookie(typeof request.headers.cookie === "string" ? request.headers.cookie : null);
  const echo = {
    ok: true,
    service: "team-scrapbook-auth-proxy-echo",
    method: request.method,
    mode,
    origin,
    cookie,
    contentType: request.headers["content-type"] ?? null,
    body: body.json ?? body.raw,
  };

  if (request.method === "POST" && mode === "logout") {
    response.statusCode = 204;
    response.setHeader("Set-Cookie", proofClearCookie());
    response.end();
    return;
  }

  if (request.method === "POST" && mode === "refresh") {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(echo));
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Set-Cookie", proofSetCookie());
  response.end(JSON.stringify(echo));
}
