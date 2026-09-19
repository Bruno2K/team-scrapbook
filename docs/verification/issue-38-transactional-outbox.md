# Issue #38 verification

Local verification on 2026-09-19 against branch `async/transactional-outbox`.

Baseline SHA: `2bc8d6c020c60fbded86ae0b3da584d81b7d3f9e` (`main`, tag `v0.3.0`).

## Architecture

- `npm run architecture:check --prefix backend`: pass

## Backend

- `npm run db:generate`: Prisma Client 6.19.2
- `npm run typecheck`: pass
- `npm run test:unit`: 12 files, 48 tests pass (backoff, payload parse, poison classification, DB-unavailable sleep, worker-only shutdown, metric labels)
- `npm run build`: pass

## PostgreSQL

- `npm run db:test:up` / migrate deploy / status / drift / `test:integration`: **not run locally**. Docker Desktop engine was not reachable (`dockerDesktopLinuxEngine` pipe missing). CI job **PostgreSQL migrations and integration** is required evidence for `backend/tests/integration/outbox.test.ts` (crash after commit, crash after claim, duplicate processing, transient retry, poison, missing handler, concurrent claim, stale owner, restart) and the drained chat notification assertion in `transactionalInvariants.test.ts`.

## Frontend

- `npm run lint`: 0 errors, 17 existing-style warnings (react-refresh / hooks). Not treated as a regression.
- `npm run typecheck`: pass
- `npm run test:ci`: 3 files / 7 tests pass; smoke script tests 4 pass
- `npm run build`: pass; existing large-chunk and browserslist staleness warnings remain

## Other

- `git diff --check`: pass

## Independent review

- Tester / Failure Analyst: blocked (unowned completion writes, vacuous restart test, unfalsifiable backoff, missing-handler poison, then missing-handler limbo); **approve** after fencing, real worker restart poll, future `availableAt` assertion, `not_configured` terminal at ceiling, and docs alignment.
- Architecture / Security: blocked (AI reply notifications, platform-owned event contract, unique-index doc drift, missing-handler limbo); **approve** after `notifyRecipient: false` on Gemini replies, messaging-owned event envelope, generic platform types, fencing, and doc/runbook fixes.
- Unresolved blockers: none. Residual: CI must execute PostgreSQL integration tests; `COMPLETED` rows are not pruned; lowering `OUTBOX_MAX_ATTEMPTS` can strand high-attempt `PENDING` rows; dedicated worker has no `/metrics` and no Socket.io emit.
