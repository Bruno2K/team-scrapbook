# Spec: Browser session and JWT lifecycle

**Owning issue:** [GitHub Issue #42](https://github.com/Bruno2K/team-scrapbook/issues/42)

**Decision:** [ADR 0002](../adr/0002-browser-session-lifecycle.md)

## Problem / context

The access JWT is already verified to Issue #32 rules, but the browser persisted it in
`localStorage`, Socket.io did not connect after login without reload, logout did not revoke a
server session, and configured-API identity failures could fall back to mock `CURRENT_USER`.

Bruno approved Option 1 after Discovery: implement in-memory short-lived access JWTs plus a
PostgreSQL-backed HttpOnly refresh cookie. Live production domain, DNS, and environment changes are
out of this implementation.

## Objective

Replace durable ordinary bearer persistence with a defended access/refresh lifecycle across HTTP,
the SPA, and Socket.io, without weakening Issue #32 identity guarantees and without introducing
OAuth, Redis, or cookie-authenticated product routes.

## Requirements

- Access JWT TTL is 15 minutes; issuance keeps HS256, `userId`/`sub` consistency, and `purpose`
  `access` (legacy access tokens without `purpose` remain verifiable).
- Ordinary access tokens exist only in SPA memory and are sent as HTTP Bearer and Socket.io
  `handshake.auth.token`.
- Refresh credential is opaque, hashed at rest, 7-day fixed expiry from login/register, and sent
  only as the `refresh_token` HttpOnly cookie on `Path=/auth`.
- Login and register return `{ user, token }` where `token` is the short-lived access JWT, and they
  also set the refresh cookie.
- `POST /auth/refresh` requires the refresh cookie and an allowed Origin, resolves the current user
  through the identity boundary, rejects deleted and AI-managed users, and returns a new access JWT
  without exposing the refresh token.
- `POST /auth/logout` requires an allowed Origin, revokes the matching refresh session when present,
  clears the cookie, and is idempotent when the session is already absent or revoked.
- Product routes still require the bearer access token. The refresh cookie alone is insufficient.
- Frontend boot deletes legacy `localStorage.token`, bootstraps via `POST /auth/refresh`, and does
  not redirect to login until bootstrap finishes.
- At most one shared refresh attempt is used for concurrent 401s on product requests.
- Logout clears memory auth even if the logout HTTP call fails, disconnects Socket.io, notifies
  other tabs without sending credentials, and navigates to login.
- Configured API mode never fabricates mock `CURRENT_USER` after a failed current-user fetch.

## Out of scope

- OAuth/OIDC, MFA, passkeys, social login.
- Redis, refresh-token families, device metadata, account session UI.
- Sliding refresh expiration and per-refresh rotation.
- `SameSite=None` as the default production cookie model.
- Express `trust proxy` unless cookie logic depended on it (it does not).
- Live Railway/Vercel/DNS/secret/CORS production mutations.
- Query-string ordinary session authentication.

## Contracts / invariants

- Issue #32 access verification, deleted-user, AI-managed, production secret, and Steam
  `steam-link` purpose-token separation remain unchanged.
- Cookie-authorized POSTs are only `/auth/refresh` and `/auth/logout`.
- CSRF policy is SameSite=Lax plus exact Origin allowlist from configured frontend origins.
- CORS never pairs `*` with credentials.
- Refresh token hashes are unique; user deletion cascades refresh rows.
- OpenAPI documents the new operations; `npm run contract:check` stays green without new
  exclusions for auth routes.

## Non-functional requirements

Local development must keep HTTP cookies working on localhost (`Secure=false`, SameSite=Lax,
host-only). Production cookie `Secure=true` is encoded in application policy; attaching the
same-site API hostname is a later human gate.

## Failure modes

- Missing, unknown, expired, or revoked refresh cookie: `POST /auth/refresh` returns 401.
- Missing or disallowed Origin on refresh/logout: 403, without using the refresh cookie as a
  product credential.
- Deleted or AI-managed identity: refresh fails; product bearer resolution continues to fail closed.
- Partial rollout (new frontend, old backend): bootstrap refresh 404/unusable. Forbidden pair.
- Legacy 7-day access JWTs: remain valid until expiry unless a later secret-rotation gate runs.

## Impact

- **Data / migration:** additive `RefreshSession` table; no backfill; rollback is a reverse deploy
  plus leaving unused rows.
- **Frontend:** in-memory session module, credentialed auth calls, bootstrap, BroadcastChannel,
  Socket.io lifecycle.
- **Backend:** identity refresh sessions, cookie policy, Origin checks, CORS credentials, OpenAPI.
- **Infrastructure:** documentation only in this change.
- **AI:** AI-managed identities still cannot establish interactive sessions, including refresh.

## Test strategy

Backend unit tests for hashing, expiry, revocation, cookie options, Origin policy, and access JWT
verification. PostgreSQL integration for session persistence, cascade, AI-managed/deleted-user
refresh denial, and cookie-not-enough for product routes. HTTP tests for Set-Cookie, refresh,
logout, Origin, and Steam separation. Frontend tests for storage, bootstrap, 401 renewal,
BroadcastChannel, mock fallback, and Socket.io connect/disconnect/auth updates.

## Rollout / rollback

See [`../operations/session-lifecycle-rollout.md`](../operations/session-lifecycle-rollout.md).
Backend and frontend must ship as a compatible pair. Production domain/CORS/secret actions stay
human-gated.

## Acceptance criteria

- [ ] ADR 0002 records the chosen target and rejected alternatives.
- [ ] Ordinary access tokens are not durably stored in `localStorage`.
- [ ] Login/register/reload/logout/expiration behavior is deterministic and tested.
- [ ] Refresh has 7-day fixed lifetime and no rotation in this version.
- [ ] Deleted/AI-managed users cannot refresh.
- [ ] Cookie/CORS/CSRF policy is explicit and tested.
- [ ] Socket.io uses in-memory access JWT and reconnects/disconnects with session changes.
- [ ] No query-string user-session token is introduced.
- [ ] OpenAPI and `contract:check` cover the new auth operations.
- [ ] Production actions are documented and not executed by this change.

## Expected evidence

- This spec, ADR 0002, and the rollout runbook.
- Focused backend unit/integration tests and frontend/socket tests.
- Local verification commands plus CI.
- Independent Tester and Architecture/Security reviews.
- PR listing production actions that were not executed.

## Remaining risks

- Refresh tokens are not rotated; theft is bounded by 7-day expiry, logout, and user deletion.
- Connected sockets may outlive access-token expiry until reconnect.
- Legacy 7-day access JWTs overlap until expiry or a later secret-rotation gate.
- Same-site production cookie behavior depends on the future custom API domain.
