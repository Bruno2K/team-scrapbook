# ADR: In-memory access JWT and PostgreSQL refresh cookie

**Owning issue:** [GitHub Issue #42](https://github.com/Bruno2K/team-scrapbook/issues/42)

**Status:** Accepted

## Context

Issue #32 hardened access-JWT verification, production secret requirements, deleted-user rejection,
AI-managed interactive-session rejection, and Steam purpose-token separation. The browser still
persisted the ordinary access bearer in `localStorage`, which is readable by script, survives longer
than a short-lived credential should, and cannot be revoked server-side except by waiting for JWT
expiry or rotating the signing secret.

The current frontend also connects Socket.io only at first mount, so login does not establish a
realtime session without reload. Logout is a local `localStorage` delete and does not revoke a
server credential. Failed `GET /users/me` resolution can fall back to mock `CURRENT_USER` even when
the API is configured.

Production today is cross-site: the Vercel frontend custom domain and the Railway default hostname
are not same-site. Discovery rejected `SameSite=None` as the primary production design. Bruno
approved Option 1: implement the short-lived in-memory access JWT plus HttpOnly refresh cookie now,
with production later moving the API to a same-site custom hostname under the same registrable
parent as the frontend. That production hostname, DNS, and environment change remain a separate
human gate and are not executed by this change.

## Decision

Use two credentials with distinct transport and lifetime:

1. **Access credential:** HS256 JWT with Issue #32 claims and verification. TTL is 15 minutes.
   Ordinary access tokens live only in SPA process memory. HTTP product routes continue to send
   `Authorization: Bearer <access-token>`. Socket.io continues to send `handshake.auth.token`.
   Access tokens are not stored in `localStorage`, `sessionStorage`, IndexedDB, or URL query
   parameters.

2. **Refresh/session credential:** opaque cryptographically random token. Only a SHA-256 hash is
   stored in PostgreSQL (`RefreshSession`). The raw token is sent only as an HttpOnly cookie named
   `refresh_token` with `Path=/auth`. Production attributes are `Secure; SameSite=Lax` and host-only
   (no `Domain`). Development uses a host-only localhost cookie with `Secure=false` and
   `SameSite=Lax`. Refresh TTL is 7 days fixed from login/register. This version does not rotate the
   refresh token on every refresh and does not implement family/reuse detection, so multi-tab
   refresh remains a shared hashed session rather than a race protocol.

Cookie-authorized HTTP endpoints are only `POST /auth/refresh` and `POST /auth/logout`. They require
an exact allowed `Origin` from the configured frontend-origin policy (`SameSite=Lax` + Origin
check). The refresh cookie never authorizes product routes. Login and register authenticate by
credentials, establish the refresh cookie, and return the short-lived access token in JSON as
`token`.

CORS for HTTP auth uses the explicit frontend origin list with credentials enabled and never `*`
together with credentials. Socket.io origin parsing uses the same origin list. Socket.io identity
remains the in-memory access JWT, not the refresh cookie.

The approved production direction is a future human-gated custom API hostname under the same
registrable parent as the production frontend. This ADR does not configure that hostname.

## Alternatives considered

- **Durable localStorage bearer:** rejected because script-accessible storage is the defect Issue #42
  exists to remove, and it cannot revoke sessions on logout.
- **Cookie-authenticated product API:** rejected because it would expand CSRF surface to every
  mutation. Product routes stay bearer-authenticated with the short-lived access token.
- **`SameSite=None` as primary production design:** rejected because it depends on third-party
  cookie behavior and was a weaker long-term default than a same-site API hostname.
- **Stateless refresh JWT:** rejected because logout and stolen-credential revocation need server
  state. PostgreSQL already exists; a second JWT would not provide revocation.
- **Redis sessions:** rejected because Redis would add infrastructure without a demonstrated need
  beyond hashed rows and expiry/revocation columns.
- **OAuth/OIDC for this milestone:** rejected by Issue #42 and the Milestone 1 roadmap. Identity
  federation is out of scope.

## Consequences / tradeoffs

- **Positive:** ordinary access tokens are no longer durable browser secrets; logout can revoke the
  refresh session; reload recovers via `POST /auth/refresh`; Issue #32 access verification remains
  the product-route trust boundary.
- **Negative:** refresh sessions are database state that must be migrated, expired, and revoked.
- **Negative:** cookie-authorized refresh/logout require CSRF protection (SameSite=Lax + exact
  Origin). A missing or disallowed Origin is denied.
- **Negative:** a currently connected Socket.io client may outlive access-token expiry until the
  socket reconnects. This version updates socket auth credentials when the access token changes and
  reconnects if disconnected, but it does not reauthenticate every message.
- **Negative:** refresh tokens are not rotated on each refresh. A stolen refresh cookie remains
  valid until expiry, logout, user deletion, or explicit revocation.
- **Negative:** old 7-day access JWTs issued before cutover remain usable until expiry unless a
  later human-gated production secret rotation invalidates them. Removing `localStorage` prevents
  new durable storage; it does not cryptographically revoke already issued access tokens.
- **Negative:** new frontend + old backend is not a valid rollout pair because `/auth/refresh` would
  be missing.

## Follow-up implications

- Attach and verify the production custom API domain only after a separate human gate.
- Decide at cutover whether to rotate `JWT_SECRET` to invalidate leftover 7-day access JWTs.
- Do not add refresh-token families, device session UI, Redis, or OAuth unless a later issue owns
  that scope.
