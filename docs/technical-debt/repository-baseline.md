# Baseline findings and technical debt

Snapshot for `64cca16d56b8793587ac0757d5c912ef255d6851`, verified 2026-09-15. Items are
evidence from the baseline pass, not commitments to a future design.

## Confirmed defects

1. The backend test setup defaults `DATABASE_URL` to SQLite even though Prisma requires PostgreSQL.
   A caller must override it or all nine test files fail during setup.
2. Four `feedService` unit tests are stale: assertions omit current community and post fields, and
   one mock lacks `scrapMessage`. Database-backed integration tests pass.
3. `npm run lint` is red with 11 errors and 17 warnings. The root lint scope also traverses generated
   `backend/dist` declarations because the ignore only excludes the root `dist` directory.
4. The Vercel default alias serves the SPA, but Railway responds with the custom production domain
   as its sole CORS origin. Browser API calls from the default alias are therefore rejected by CORS;
   the custom domain is the coherent production entrypoint.

## Documentation drift

1. README and `backend/.env.example` described SQLite despite a PostgreSQL-only schema/migration.
   Issue #20 corrects those reproducibility-critical instructions.
2. The checked-in OpenAPI document covers only part of the implemented HTTP route surface and
   should not be treated as complete without checking route files.

## Engineering gaps

1. There is no checked-in `.github` CI workflow, so builds, lint, migrations and tests are not an
   established pull-request gate.
2. Dependency installation reports known audit findings: root 30 total (2 critical) and backend 25
   total (2 critical). This baseline did not assess exploitability or update dependencies.
3. Runtime/package-manager pinning is backend-only; the root workspace has no equivalent Node or
   npm declaration and retains both npm and Bun lockfiles.
4. The production Vite bundle warns about a 645.20 kB JavaScript chunk before gzip.

## Architectural risks

1. Socket.io delivery, notification emission and presence are owned by one Node process. Multiple
   Railway replicas would have inconsistent rooms/events, and a disconnect from one tab sets the
   shared user `online` flag false even if another connection remains.
2. API authentication falls back to a known development JWT secret when `JWT_SECRET` is missing;
   deployment configuration must enforce a real secret.
3. `/health` checks only that the Express process can answer. It does not establish PostgreSQL or
   external-integration readiness.

## Unknowns

1. Railway service configuration was verified from PR #19, checked-in operations notes and the live
   endpoint, but provider-side settings and secret presence were not independently enumerated.
2. Steam, Gemini, R2 and Giphy credentials and end-to-end production behavior were not exercised;
   verification was limited to code/configuration paths to avoid secret use and external mutations.
3. No release existed before this work. Git tags were checked after synchronizing from origin.
