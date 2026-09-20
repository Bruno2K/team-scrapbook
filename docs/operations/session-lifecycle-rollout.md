# Issue #42 session lifecycle rollout

**Owning issue:** [GitHub Issue #42](https://github.com/Bruno2K/team-scrapbook/issues/42)

**Decision:** [ADR 0002](../adr/0002-browser-session-lifecycle.md)

This runbook documents the compatible release pair and the later production hostname cutover. It
does **not** authorize executing live Railway, Vercel, DNS, secret, or production CORS changes.

## Compatibility rule

New frontend + old backend is **not** a valid rollout pair. The SPA bootstrap depends on
`POST /auth/refresh`. Deploy backend and frontend as one compatible release pair (backend first or
together). Old frontend + new backend remains temporarily usable: login/register still return an
access JWT, but the old SPA will keep writing `localStorage.token` until the new frontend ships.

## Prepared application behavior

After the Issue #42 code merge:

- Access JWT TTL is 15 minutes and is stored only in SPA memory.
- Refresh sessions are PostgreSQL rows containing only a token hash, expiry, and optional
  revocation timestamp.
- The refresh cookie is host-only, `HttpOnly`, `SameSite=Lax`, `Path=/auth`. `Secure` is true when
  `NODE_ENV=production`.
- HTTP CORS uses the configured frontend origin list with credentials. Wildcard origins are not
  valid with credentialed cookies.

## Documented cutover sequence (not executed here)

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
6. **Deploy sequencing.** Apply the additive `RefreshSession` migration with the backend deploy
   (`prisma migrate deploy`). Then deploy or redeploy the frontend that calls `/auth/refresh`.
7. **Session overlap/invalidation decision.** Human-gated, explicit:
   - Default: old 7-day access JWTs issued before cutover remain valid until their expiry.
   - Removing `localStorage` only prevents new durable storage; it does not revoke already issued
     access tokens.
   - Rotating `JWT_SECRET` would invalidate all outstanding access JWTs and is a separate high-blast
     human gate. Do not rotate it as part of the code merge.
8. **Smoke verification.** After the approved domain/config cutover, run the repository smoke
   workflow against the paired frontend and backend URLs. Manually confirm login, reload bootstrap,
   authenticated product request, logout, and that the refresh cookie is HttpOnly and not readable
   from JavaScript.
9. **Rollback.** Roll back by redeploying the previous **paired** frontend and backend. The
   `RefreshSession` table is additive; unused rows can remain. Do not run a destructive down
   migration against production as part of ordinary rollback. Cookie `Path=/auth` means an old
   backend simply stops issuing or consuming the new cookie contract. If a custom domain was
   attached, reverting DNS/Railway hostname is a separate human-gated infrastructure rollback.

## Production actions still blocked

Do not execute without a later explicit Bruno approval:

- attaching or changing the Railway custom domain;
- editing DNS;
- changing Railway, Vercel, or GitHub Environment variables;
- rotating `JWT_SECRET` or other production secrets;
- production session invalidation / mass logout;
- live production CORS origin changes;
- manual production deploys outside the normal repository flow.
