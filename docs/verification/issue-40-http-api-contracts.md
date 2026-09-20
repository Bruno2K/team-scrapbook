# Verification: HTTP API contracts and CI drift detection

**Owning issue:** [GitHub Issue #40](https://github.com/Bruno2K/team-scrapbook/issues/40)

## Local evidence

- Baseline: `be67a60601059ee5437c0b8bbd4750feca36998c` (`origin/main`)
- Branch: `contracts/http-openapi-drift`
- `npm run contract:check` (backend): pass — 77 runtime operations including documentation surfaces, 76 OpenAPI operations, product METHOD+PATH aligned
- `npm run architecture:check` (backend): pass
- `npm run typecheck` (backend): pass
- `npm run test:unit` (backend): pass — 13 files, 58 tests
- `npm run build` (backend): pass
- `npm run db:generate`: run as part of the backend verification sequence
- PostgreSQL integration: **not run locally** — Docker Desktop engine was unavailable (`dockerDesktopLinuxEngine` pipe missing). Rely on the CI job **PostgreSQL migrations and integration**.
- Frontend `PostFeedInput.type` aligned to `"post" | "achievement"` to match `POST /feed` runtime Zod (no active caller sent `"community"` or `"scrap"`)
- Frontend `lint`: 0 errors, 17 warnings (existing react-refresh/hooks warnings)
- Frontend `typecheck`: pass
- Frontend `test:ci`: pass (7 vitest + 4 smoke)
- Frontend `build`: pass
- `git diff --check`: pass

## Independent review

- Tester / Failure Analyst: no structural blockers. Residual: auth/schema not drift-gated; Express 4 `_router` brittleness; parameterized-mount regex untested because current mounts are static.
- Architecture / Security: no blockers. Steam callback and AI 403 documentation match runtime. Residual: auth semantics not CI-enforced; `/metrics` and `/api-docs.json` remain unauthenticated documentation/ops surfaces (pre-existing).

## Remaining contract gaps (out of scope)

- Socket.io event contracts
- Nested serialized view field-completeness
- Typed frontend error taxonomy
