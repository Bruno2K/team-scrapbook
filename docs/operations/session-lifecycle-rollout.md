# Issue #42 session lifecycle rollout

**Owning issue:** [GitHub Issue #42](https://github.com/Bruno2K/team-scrapbook/issues/42);
transport amendment [GitHub Issue #44](https://github.com/Bruno2K/team-scrapbook/issues/44)

**Decision:** [ADR 0002](../adr/0002-browser-session-lifecycle.md)

This runbook documents the compatible release pair and the production auth-transport cutover. It
does **not** authorize executing live Railway, Vercel, DNS, secret, or production CORS changes.

## Compatibility rule

New frontend + old backend is **not** a valid rollout pair. The SPA bootstrap depends on
`POST /auth/refresh`. Deploy backend and frontend as one compatible release pair (backend first or
together). Old frontend + new backend remains temporarily usable: login/register still return an
access JWT, but the old SPA will keep writing `localStorage.token` until the new frontend ships.

After Issue #44, the new frontend also requires the Vercel `/auth/:path*` rewrite. Shipping that
frontend without the matching Railway Issue #42 backend still fails bootstrap.

## Prepared application behavior

After the Issue #42 code merge:

- Access JWT TTL is 15 minutes and is stored only in SPA memory.
- Refresh sessions are PostgreSQL rows containing only a token hash, expiry, and optional
  revocation timestamp.
- The refresh cookie is host-only, `HttpOnly`, `SameSite=Lax`, `Path=/auth`. `Secure` is true when
  `NODE_ENV=production`.
- HTTP CORS uses the configured frontend origin list with credentials. Wildcard origins are not
  valid with credentialed cookies.

After the Issue #44 code merge:

- Browser auth calls same-origin `/auth/*` on the frontend origin.
- Vercel rewrites `/auth/:path*` to the existing Railway backend before the SPA fallback.
- Auth responses are explicitly `Cache-Control: no-store` on the backend and non-cacheable on
  Vercel.
- Product HTTP and Socket.io remain direct to Railway through `VITE_API_URL`.
- Local development uses the Vite `/auth` proxy to `http://localhost:3000` so auth URLs stay
  relative.

## Historical custom-domain evidence

The original Issue #42 production direction was a same-site custom API hostname on Railway under
the same registrable parent as the frontend. That path was not executed. Railway rejected the
requested custom domain because the current plan does not permit another custom domain. No plan
upgrade, DNS change, provider-variable change, production deploy, or secret rotation was performed
from that attempt. Bruno selected Option 2: keep the current Railway plan and proxy browser auth
through Vercel same-origin routing.

The custom-domain sequence below is retained as historical evidence only. It is **not** the current
rollout path and is **not** required for Issue #44.

### Historical sequence (not the current path)

1. **Code merge.** Merge the Issue #42 pull request after CI and independent reviews. This deploys
   application support only; it does not attach a custom API domain.
2. **Custom API domain setup.** Human-gated: attach a Railway custom hostname under the same
   registrable parent as the production frontend (for example an `api.` host next to the existing
   frontend domain). Do not use `SameSite=None` to keep the current Railway default hostname.
3. **DNS verification.** Human-gated: create the DNS records Railway requires and wait until the
   certificate and hostname resolve on HTTPS.
4. **Production origin/config update.** Human-gated: set backend `CORS_ORIGIN` to the exact
   production frontend origin (no `*`, no extra preview origins unless explicitly approved).
5. **Frontend API base update if necessary.** Human-gated: set Vercel `VITE_API_URL` to the new
   same-site API origin and redeploy the frontend so the SPA and cookies target that host.

## Current production mismatch (documented, not fixed here)

Observed at Issue #44 implementation time and left as a separately gated operational incident:

- Vercel frontend production SHA: `be2b3253eec3f07e2763d7df7cb5e927a0c4a4ab`
- Railway backend SHA: `aa645f80b5a3d237d465c549f984f4673c4dd984`

Do not silently rollback the frontend. Do not silently deploy Railway. Login/register may be
degraded because the new frontend sends `credentials: include` to the old backend without a
matching `Access-Control-Allow-Credentials` contract. Containment remains human-gated.

## Documented cutover sequence (not executed here)

1. **Code merge.** Merge the Issue #44 pull request after CI, preview transport proof, and
   independent reviews. This ships the Vercel auth rewrite, frontend same-origin auth URLs, Vite
   local `/auth` proxy, and backend auth `Cache-Control: no-store`. It does not cut production
   traffic by itself beyond the normal Git-connected Vercel production deploy of `main`.
2. **Compatible Railway backend.** Human-gated: deploy the Railway backend that includes Issue #42
   (`RefreshSession`, `/auth/refresh`, `/auth/logout`, credentialed CORS) before or together with
   the frontend that depends on refresh. The current `aa645f80` backend is not a valid pair.
3. **Production origin/config.** Human-gated if still needed: set backend `CORS_ORIGIN` to the exact
   production frontend origin. Product HTTP and Socket.io remain cross-origin to Railway and still
   need that allowlist. Do not add preview origins automatically. Do not widen CORS to `*`.
4. **Frontend API base.** Human-gated if still needed: keep `VITE_API_URL` pointing at the Railway
   origin for product HTTP and Socket.io. Auth URLs must stay relative `/auth/*`.
5. **Session overlap/invalidation decision.** Human-gated, explicit:
   - Default: old 7-day access JWTs issued before cutover remain valid until their expiry.
   - Removing `localStorage` only prevents new durable storage; it does not revoke already issued
     access tokens.
   - Rotating `JWT_SECRET` would invalidate all outstanding access JWTs and is a separate high-blast
     human gate. Do not rotate it as part of the code merge.
6. **Smoke verification.** After the approved paired cutover, run the repository smoke workflow
   against the paired frontend and backend URLs. Manually confirm login, reload bootstrap through
   same-origin `/auth/refresh`, authenticated product request to Railway, Socket.io to Railway,
   logout, and that the refresh cookie is HttpOnly on the frontend host and not readable from
   JavaScript.
7. **Rollback.** Roll back by redeploying the previous **paired** frontend and backend. The
   `RefreshSession` table is additive; unused rows can remain. Do not run a destructive down
   migration against production as part of ordinary rollback. Cookie `Path=/auth` means an old
   backend simply stops issuing or consuming the new cookie contract. Reverting the Vercel `/auth`
   rewrite is a frontend rollback; it does not require DNS or a Railway custom domain.

## Production actions still blocked

Do not execute without a later explicit Bruno approval:

- attaching or changing a Railway custom domain;
- upgrading the Railway plan;
- editing DNS;
- changing Railway, Vercel, or GitHub Environment variables;
- rotating `JWT_SECRET` or other production secrets;
- production session invalidation / mass logout;
- live production CORS origin changes;
- manual production deploys outside the normal repository flow;
- creating production test `RefreshSession` rows merely to prove proxy transport.
