# Development, runtime and verification baseline

Baseline candidate: `64cca16d56b8793587ac0757d5c912ef255d6851` (`main`, verified 2026-09-15).

## Prerequisites and package management

- Node 22.23.2 and npm 10.9.8 are the repository-wide runtime expectation. The root and Railway
  backend `.node-version` files pin Node; both package manifests declare the same npm version.
- npm is authoritative because both workspaces have `package-lock.json`; use `npm ci` for locked
  installs. The unused historical `bun.lockb` was removed when the CI baseline was established.
- Local PostgreSQL is required only for persistence integration tests and migration validation.
  SQLite is not supported by the Prisma datasource, migrations, or test commands.

## Reproducible local sequence

```bash
# frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build

# backend unit/type/build checks (from ./backend; no running database required)
npm ci
npm run db:generate
npm run typecheck
npm run test:unit
npm run build

# backend persistence checks with the checked-in disposable PostgreSQL 16 service
npm run db:test:up
export DATABASE_URL=postgresql://postgres:postgres@localhost:55432/team_scrapbook_test
npm run db:test:prepare
npm run test:integration
npm run db:test:down
```

`db:test:up` creates a repository-owned PostgreSQL 16 container with temporary storage and waits for
readiness; `db:test:down` removes it. `db:test:prepare` rejects non-PostgreSQL URLs and database names
without a distinct `test` segment, applies checked-in migrations, verifies migration status, and
fails on drift between the migrated database and `schema.prisma`. Integration tests repeat the URL
guard and run serially to keep cleanup deterministic. The GitHub Actions workflow uses its own
disposable service with the same database name; neither path requires production or external-provider
credentials. Backend `npm test` is the database-free unit suite, while `npm run test:all` includes
integration tests and therefore requires the prepared test database.

For interactive development, run `npm run dev:api` from the root and `npm run dev` in a second
terminal. Vite defaults to port 8080 in this repository; Express defaults to port 3000.

## Environment variable categories

Do not commit values. The checked-in examples define the complete baseline categories:

- Browser: `VITE_API_URL`; optional `VITE_GIPHY_API_KEY`.
- Core API: `DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, optional `NODE_ENV`.
- Steam: `STEAM_WEB_API_KEY`, `BACKEND_URL`.
- Gemini: `GEMINI_API_KEY`, optional `GEMINI_MODEL`.
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`.

## Deployment commands

- Vercel root: install `npm install`, build `npm run build`, publish `dist`.
- Railway `/backend`: build `npm ci && npx prisma generate && npm run build`; pre-deploy
  `npx prisma migrate deploy`; start `npm run start`; listen on port 3000.
- PR #19 repaired Railway Prisma config parsing and pinned Node. Subsequent `main` commits repaired
  the initial PostgreSQL migration, pinned npm, and checked in the Railway command record.

## Verification evidence

Commands ran on Windows with local Node 20.10.0/npm 10.2.3. The runtime difference is recorded;
backend generation and compilation still succeeded, and production uses the pinned Node version.

- `npm ci` at root: pass; 619 packages installed from lockfile. Audit reported 30 vulnerabilities
  (2 low, 7 moderate, 19 high, 2 critical).
- `npm run lint`: fail; 11 errors and 17 warnings. Some errors came from generated backend `dist`
  declarations traversed by the root lint command; source errors also remain.
- root `npm test`: pass; 1 file and 1 test.
- root `npm run build`: pass; Vite produced `dist`. It warned that the main JavaScript chunk was
  645.20 kB before gzip and that browser compatibility data is stale.
- backend `npm ci`: pass; 352 packages installed from lockfile. Audit reported 25 vulnerabilities
  (2 low, 5 moderate, 16 high, 2 critical); Node 20.10.0 produced one engine warning.
- backend `npm run db:generate`: pass with Prisma Client 6.19.2.
- backend `npm run build`: pass.
- backend migration against disposable PostgreSQL 16: pass; the only checked-in migration applied
  cleanly and `prisma migrate status` reported the schema current.
- backend `npm test` against PostgreSQL 16: partial failure; 24 of 28 tests passed. All six
  integration suites passed. Four `feedService` unit tests failed because mocks/assertions do not
  reflect current community/scrap aggregation and post fields.
- Live deployment: Vercel frontend/default alias and custom domain returned HTTP 200; the deployed
  bundle referenced the Railway service; Railway `/health` returned HTTP 200.

The local ignored `backend/.env` observed during verification still used a `file:` URL. That file
was not changed because it is developer-local; copy the corrected `backend/.env.example` or set a
PostgreSQL URL before running Prisma commands.

## `v0.1.0` gate

The baseline is functional enough to preserve: both production builds pass, Prisma generation and
the PostgreSQL migration pass, all database-backed integration suites pass, and both deployments
are reachable. The remaining lint and unit-test failures are recorded engineering debt rather than
evidence of a broken runtime. `v0.1.0` therefore points to the unmodified candidate commit above,
not to the documentation commit created by Issue #20.

## Release safety

The executable release gate, manual post-deploy smoke workflow, release evidence format, provider
rollback steps, database incident policy, configuration-flag policy, and required `main` protection
are maintained in [`release-safety.md`](release-safety.md). The smoke command is repository-owned and
does not require Steam, Gemini, R2, or Giphy credentials.
