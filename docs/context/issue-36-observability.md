# Context Pack: Observability, SLOs and lifecycle

## Owning issue

[GitHub Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)

## Exact objective

Establish a process-local structured logging, HTTP correlation, metrics, dependency/realtime signals, health/readiness, graceful lifecycle, and SLO baseline without Milestone 2 infrastructure.

## Known facts

- Protected `main` after PR #35 is `f92c32d3b11ce3373baeb07dd687f13a0f453572`.
- `/health` is process liveness; `/health/ready` is bounded PostgreSQL `SELECT 1` with 5s cache ([release-safety](../operations/release-safety.md)).
- There was no structured logger, request correlation, metrics surface, or graceful shutdown before this issue.
- Socket.io and notification delivery are single-process ([architecture baseline](../architecture/repository-baseline.md)).
- Architecture, security, and transactional contracts from Issues #30/#32/#34 must be preserved.

## Read first

1. GitHub Issue #36
2. `backend/src/index.ts`, `backend/src/app.ts`, `backend/src/controllers/healthController.ts`, `backend/src/socket.ts`
3. `backend/src/db/transactions.ts`
4. `docs/operations/release-safety.md`
5. `docs/architecture/modular-monolith.md` (platform vs product modules)

## Read only if needed

- Provider files (`steamService.ts`, `geminiService.ts`, `uploadService.ts`) when changing instrumentation.
- Smoke script if health JSON shape might change.

## Probably irrelevant

- Frontend UI redesign, Gemini SDK migration, Redis, workers, outbox, distributed tracing backends.

## Contracts / invariants affected

- Health JSON fields used by smoke (`status`, `service`, `timestamp`, `release`, readiness `checks.database`).
- No secrets in logs; bounded metric labels; liveness ≠ readiness.
- Signal handlers must not be installed by importing `app`.

## Current known risks

- Metrics and socket gauges are per Railway replica, not global.
- Railway/Vercel investigation is based on repository deployment history, not a fabricated incident.

## Required verification

- Backend architecture, unit, integration, typecheck, build, Prisma generate/migrate/status/drift.
- Frontend lint/typecheck/tests/build and smoke tests.
- Independent Tester/Failure Analyst and Architecture/Security review.

## Expected artifacts / evidence

- `backend/src/platform/observability/`
- `docs/operations/observability.md`, `docs/operations/slo.md`, `docs/operations/railway-production-note.md`
- Controlled failure tests and PR evidence.

## Stop conditions

Issue #36 acceptance is met, PR is open, CI is green, reviews have no blockers. Do not start Milestone 2 or tag `v0.3.0`.

## Escalation triggers

Stop if health/readiness semantics would be merged, secrets would be logged, metric labels become unbounded, or Milestone 2 infrastructure is required.
