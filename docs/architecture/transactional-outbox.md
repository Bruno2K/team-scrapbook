# Transactional outbox

**Owning issue:** [GitHub Issue #38](https://github.com/Bruno2K/team-scrapbook/issues/38)

This is the first durable asynchronous processing path. The contract is **at-least-once processing with idempotent consumers**, not exactly-once delivery.

## Placement

| Piece | Location | Ownership |
| --- | --- | --- |
| Schema | `OutboxEvent` in `backend/prisma/schema.prisma` | shared database contract |
| Domain event construction | `modules/messaging/domain/chatMessageCreated.ts` | messaging module |
| Outbox append/claim | `backend/src/platform/outbox/` | platform primitive |
| Consumer registration | `backend/src/registerOutboxConsumers.ts` | composition root |
| Durable effect | `createNotification` public contract | notifications module |
| HTTP API process | `backend/src/index.ts` | may embed the poller |
| Dedicated worker | `backend/src/worker.ts` / `npm run start:worker` | no HTTP server |

The outbox is not a generic internal RPC bus. Product modules do not import other modules' internals to process events. Handlers are registered explicitly.

## Envelope and versioning

Each row stores `eventType`, `eventVersion`, `ownerModule`, optional `aggregateType`/`aggregateId`, and JSON `payload`.

Current event:

- Type: `messaging.message.created`
- Version: `1`
- Aggregate: `ChatMessage` / message id
- Required payload: `messageId`, `conversationId`, `senderId`, `recipientId`

Compatibility:

- Consumers ignore unknown payload fields.
- Required v1 fields must remain present.
- Breaking changes use a new `eventVersion` and a newly registered handler. Old rows keep their version until processed or marked failed.
- Duplicate appends of the same message-created event are permitted. Idempotency of the durable effect comes from `Notification.dedupeKey` (`chat-message:${messageId}`) and the P2002 winner-read in the notifications module.

Payload bodies, user ids, and message ids are not metric labels and are not written to logs.

## Durability semantics

1. `prismaMessageRepository.persist` inserts the chat message, the outbox row, and the conversation `updatedAt` in one PostgreSQL transaction.
2. If that transaction commits, the notification work cannot be lost because of an API crash; it remains in `OutboxEvent`.
3. The worker claims a bounded batch, **closes the claim transaction**, then runs the consumer.
4. Socket.io `notification` emission still happens only if `setNotificationDelivery` is registered in that process (API-embedded worker). It remains a best-effort projection after durable notification persistence.
5. Socket.io `message` events, Gemini replies, Steam, R2, and non-chat notifications remain best-effort and are not on this outbox.

## Claiming and leases

Claiming uses a short `UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED)` against rows with `availableAt <= now()` that are `PENDING` below the attempt ceiling or `PROCESSING` (expired lease). Multiple workers are safe.

On claim:

- `status = PROCESSING`
- `attemptCount` increments
- `availableAt` and `claimExpiresAt` move forward by `OUTBOX_LEASE_MS` (default 30s)

A crash after claim leaves the row leased until `availableAt`. Another worker then recovers it. Recovered `PROCESSING` rows increment attempts; exceeding `OUTBOX_MAX_ATTEMPTS` marks `FAILED` without running the handler, so crash loops cannot retry forever.

Do not hold the database transaction open while the consumer runs.

## Retry, backoff, poison

Defaults: 8 attempts, 1s initial delay, 5m max delay. Delay = `min(max, initial * 2^(attemptCount-1))` and is persisted in `availableAt`, so it survives restart.

Retryable failures return to `PENDING`. After the ceiling, status is `FAILED` with `failureCategory` and `lastErrorCode` (error name only). There is no infinite retry.

## Idempotency

The chat consumer uses existing `Notification.dedupeKey` `chat-message:${messageId}` and the P2002 winner-read path. Replaying an outbox event cannot create a second durable notification. Realtime emit runs only when a new row is created.

## Worker lifecycle

The worker logs `outbox.worker.startup`, `outbox.worker.ready`, claim/success/retry/terminal/lease recovery, and `outbox.worker.shutdown`. SIGTERM/SIGINT stop claiming, wait for the in-flight batch via `stopWorkers`, then disconnect Prisma. Empty polls sleep `OUTBOX_POLL_INTERVAL_MS`. PostgreSQL errors sleep `OUTBOX_UNAVAILABLE_BACKOFF_MS` and do not spin.

See [outbox-worker operations](../operations/outbox-worker.md).
