# Context Pack: Transactional outbox

## Owning issue

[GitHub Issue #38](https://github.com/Bruno2K/team-scrapbook/issues/38)

## Exact objective

Add a PostgreSQL transactional outbox and durable worker so a committed chat message cannot lose its required notification when the API process crashes, using at-least-once processing and an idempotent consumer.

## Known facts

- Protected `main` after PR #37 / tag `v0.3.0` is `2bc8d6c020c60fbded86ae0b3da584d81b7d3f9e`.
- Chat notifications are created in `afterCommit` in `chatController.ts` and `socket.ts`; a crash after commit can lose them ([Issue #34 spec](../specs/issue-34-transactional-invariants.md)).
- `Notification.dedupeKey` is unique; chat uses `chat-message:${message.id}`.
- `prismaMessageRepository.persist` already wraps message insert and conversation `updatedAt` in one transaction.
- Observability lives in `backend/src/platform/observability/` ([Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)).
- There is no worker entrypoint, broker, or Redis/BullMQ dependency.
- Modular-monolith rules: Prisma only in module persistence; no cross-module internal imports ([modular-monolith.md](../architecture/modular-monolith.md)).

## Read first

1. GitHub Issue #38
2. `backend/src/modules/messaging/persistence/prismaMessageRepository.ts`
3. `backend/src/modules/notifications/index.ts`
4. `backend/src/platform/observability/lifecycle.ts` and `metrics.ts`
5. `docs/architecture/modular-monolith.md` (Prisma and transaction ownership)

## Read only if needed

- Relationship/community/scrap notification call sites — only to confirm they stay best-effort.
- Steam/Gemini/R2 services — remaining best-effort provider work.

## Probably irrelevant

- Frontend UI, Redis, Socket.io adapter, tracing backends, generic schedulers.

## Contracts / invariants affected

- Message persist and outbox insert commit together or not at all.
- Durable effect is one `CHAT_MESSAGE` notification per message id.
- Socket.io notification and message emits remain best-effort.
- Metric labels stay bounded; no event/user/message/request ids as labels.
- Additive Prisma migration only.

## Current known risks

- Dedicated Railway worker service is a human-gated production change.
- Worker process has no Socket.io; realtime notification projection depends on an API-embedded poller or a later adapter.
- Lease expiry plus at-least-once delivery can replay; consumers must stay idempotent.

## Required verification

- `npm run architecture:check --prefix backend`
- Backend generate, typecheck, unit, build, migrate deploy/status/drift, integration including outbox failure tests
- Frontend lint/typecheck/tests/build, smoke, `git diff --check`
- Independent Tester/Failure Analyst and Architecture/Security reviews

## Expected artifacts / evidence

- Outbox schema/migration, platform outbox primitives, worker entrypoint, chat vertical slice
- Failure tests listed in Issue #38
- `docs/architecture/transactional-outbox.md`, `docs/operations/outbox-worker.md`, verification record

## Stop conditions

Issue #38 acceptance is met, PR is open, reviews have no unresolved blockers. Do not migrate other side effects, introduce Redis/BullMQ, or change Railway production.

## Escalation triggers

Stop if SKIP LOCKED cannot be expressed safely, if a destructive migration appears required, if module boundaries cannot hold, or if production Railway services would be created without human approval.
