# Outbox worker operations

**Owning issue:** [GitHub Issue #38](https://github.com/Bruno2K/team-scrapbook/issues/38)

## Local start

From `backend/`:

```bash
npm run dev          # API; embeds the worker unless OUTBOX_WORKER_ENABLED=false
npm run dev:worker   # dedicated worker, no HTTP
```

Production-shaped start after `npm run build`:

```bash
npm run start
npm run start:worker
```

Both processes share `DATABASE_URL`. The dedicated worker does not bind `$PORT`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `OUTBOX_WORKER_ENABLED` | enabled unless `false` | API-embedded poller |
| `OUTBOX_MAX_ATTEMPTS` | 8 | terminal failure ceiling |
| `OUTBOX_INITIAL_DELAY_MS` | 1000 | first retry delay |
| `OUTBOX_MAX_DELAY_MS` | 300000 | retry delay cap |
| `OUTBOX_LEASE_MS` | 30000 | claim lease / crash recovery window |
| `OUTBOX_POLL_INTERVAL_MS` | 1000 | sleep when the batch is empty |
| `OUTBOX_BATCH_SIZE` | 10 | max rows per claim |
| `OUTBOX_UNAVAILABLE_BACKOFF_MS` | 2000 | sleep when PostgreSQL is down |

## Railway topology (recommendation only)

**HUMAN APPROVAL REQUIRED: Railway worker deployment**

Do not create or modify Railway services without explicit human approval.

Recommended:

1. Keep the existing public API service: build `npm ci && npx prisma generate && npm run build`, pre-deploy `npx prisma migrate deploy`, start `npm run start`.
2. Add a **second Railway service from the same `/backend` image** with start `npm run start:worker`. No public HTTP port.
3. After the worker service is healthy, set `OUTBOX_WORKER_ENABLED=false` on the API so the web replica does not also poll. Until that service exists, leave the API embed enabled so chat notifications still process on the current single Node service.
4. One worker replica is enough for this vertical slice. Multiple worker replicas are claim-safe via `SKIP LOCKED`.
5. API replicas still do not share Socket.io rooms; a standalone worker will persist notifications but will not emit `notification` socket events. That remains deferred (no distributed adapter in this issue).

## Replicas

Concurrent claimers cannot own the same row at once. At-least-once replay after lease expiry is expected. Scale workers only for backlog, not for Socket.io fan-out.

## Inspecting failures

Rows in `FAILED` are poison/exhausted work. Bounded fields: `eventType`, `eventVersion`, `ownerModule`, `attemptCount`, `failureCategory`, `lastErrorCode`, `failedAt`. Do not dump `payload` into logs or tickets that leave the operator boundary.

Distinguish:

| Symptom | Likely cause |
| --- | --- |
| `outbox_backlog` rising, worker up | slow handlers or downstream notification DB issues |
| `FAILED` rows with `poison` | malformed payload/handler |
| `FAILED` rows with `not_configured` | worker missing a registered handler (deploy skew); replay after the new worker is live |
| `outbox.worker.poll_failure` | PostgreSQL down; worker is backing off |
| No `outbox.worker.ready` | worker process not started or crashing at boot |
| Notification row exists, no socket event | expected for standalone worker; Socket.io is best-effort on the API process |

## Replay of terminal failures

After fixing the consumer, replay one row:

```sql
UPDATE "OutboxEvent"
SET
  "status" = 'PENDING',
  "attemptCount" = 0,
  "availableAt" = NOW(),
  "failedAt" = NULL,
  "processedAt" = NULL,
  "claimedAt" = NULL,
  "claimExpiresAt" = NULL,
  "claimOwner" = NULL,
  "failureCategory" = NULL,
  "lastErrorCode" = NULL,
  "updatedAt" = NOW()
WHERE "id" = $1
  AND "status" = 'FAILED';
```

The application helper `replayTerminalOutboxEvent` performs the same transition. There is no public HTTP replay endpoint.

## Graceful shutdown

SIGTERM/SIGINT: stop the poll loop, finish the in-flight batch, disconnect Prisma, 10s bound shared with the API lifecycle.

## Known limitations

- Chat notification durability only.
- No guaranteed WebSocket delivery.
- No Redis/BullMQ.
- No hosted metrics/log pipeline beyond process stdout and `/metrics` on the API process. The dedicated worker does not expose `/metrics` in this issue; its counters exist in-process if later scraped.
