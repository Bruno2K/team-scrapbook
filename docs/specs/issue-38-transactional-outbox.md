# Spec: Transactional outbox and durable async processing

**Owning issue:** [GitHub Issue #38](https://github.com/Bruno2K/team-scrapbook/issues/38)

## Problem / context

Milestone 1 made chat messages durable, but `CHAT_MESSAGE` notifications still run in post-commit `afterCommit`. A crash after commit can keep the message and lose the notification. Issue #38 requires the first PostgreSQL-native durable async path.

## Objective

Commit the business mutation and its outbox event in one PostgreSQL transaction, then process the event at-least-once with an idempotent notification consumer.

## Requirements

- Additive `OutboxEvent` table with status, attempts, `availableAt`, and lease metadata.
- `FOR UPDATE SKIP LOCKED` claiming in a short transaction; external work outside that transaction.
- Bounded retry with deterministic exponential backoff; terminal `FAILED` after the attempt ceiling.
- Dedicated worker entrypoint sharing the backend image; API may embed the same poller until a Railway worker is approved.
- Vertical slice: chat message persist → `messaging.message.created` v1 → `createNotification` with existing `chat-message:${messageId}` dedupe. Gemini AI replies do not enqueue that event (`notifyRecipient: false`).
- Observability aligned with Issue #36; no payload/secret/id metric labels.

## Out of scope

- Redis/BullMQ, Socket.io adapter, guaranteed WebSocket delivery, presence, log shipping, tracing backends, Steam/Gemini/R2 workflow migration, generic scheduler, exactly-once claims, production Railway service creation.

## Contracts / invariants

- At-least-once processing, never exactly-once.
- Duplicate/replayed processing creates at most one durable notification.
- Multiple workers cannot own the same row at the same time.
- Expired leases become claimable again; crash after claim cannot strand work permanently.
- Messaging must not import notification internals; the worker composition root registers the consumer.

## Event envelope

`messaging.message.created` version 1 payload required fields: `messageId`, `conversationId`, `senderId`, `recipientId`. Consumers ignore unknown fields. Breaking changes require a new `eventVersion` and registered handler. Additive optional fields may appear in a later compatible v1 document revision only if existing required fields remain.

## Retry / backoff

- `OUTBOX_MAX_ATTEMPTS` default 8
- `OUTBOX_INITIAL_DELAY_MS` default 1000
- `OUTBOX_MAX_DELAY_MS` default 300000
- delay = min(max, initial * 2^(attemptCount-1)) after a failed attempt
- Claim increments `attemptCount`; reclaiming a leased row whose count exceeds max goes terminal without running the handler

## Failure modes

- Crash after commit: event remains `PENDING`; later worker completes it.
- Crash after claim: lease expires via `availableAt`; another worker claims it.
- Transient handler error: `PENDING` with future `availableAt`.
- Exhausted attempts: `FAILED`, no automatic retry.
- PostgreSQL unavailable: worker logs a bounded failure, sleeps, does not spin.

## Impact

- **Data / migration:** additive `OutboxEvent` + `OutboxStatus`; rollback is unused-table drop in a follow-up migration, not performed here.
- **Frontend:** not applicable.
- **Backend:** messaging persist, platform outbox, worker entry, chat HTTP/Socket stop creating notifications inline.
- **Infrastructure:** recommended second Railway start command; no production change in this issue.
- **AI:** Gemini chat replies remain best-effort `setImmediate` / inline socket work.

## Test strategy

Deterministic PostgreSQL tests for crash-after-commit, crash-after-claim, duplicate processing, transient retry, poison/terminal, concurrent claimers, restart, and database unavailability. Unit tests for backoff, payload parse, metrics cardinality, worker sleep-on-error, and architecture.

## Rollout / rollback

Ship code with API-embedded worker default (`OUTBOX_WORKER_ENABLED` not `false`) so current single Railway API keeps processing. Dedicated `npm run start:worker` is documented. Creating a Railway worker service requires explicit human approval. Rollback: revert deploy; unused outbox rows are harmless; chat notifications would return to lost-on-crash behavior only if persist also reverts.

## Acceptance criteria

- [ ] Additive documented outbox schema
- [ ] Chat human-message persist writes the outbox event atomically; AI replies set `notifyRecipient: false`
- [ ] Worker claims/processes with SKIP LOCKED and lease recovery
- [ ] Required failure tests pass
- [ ] Architecture, security, transaction, and observability checks remain green
- [ ] Independent reviews have no unresolved blockers
- [ ] Railway production topology is documented, not executed

## Expected evidence

Commands, test names, review conclusions, and explicit `HUMAN APPROVAL REQUIRED: Railway worker deployment` when a dedicated service is still absent.

## Remaining risks

Socket.io notification emit from a standalone worker is not available without a distributed adapter. Friend/community/scrap notifications stay best-effort.
