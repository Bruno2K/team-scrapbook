# Observability architecture

**Owning issue:** [GitHub Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)

This is the process-local observability baseline for the current single Railway Node API plus Vercel frontend. It does not deploy Prometheus, Grafana, OpenTelemetry collectors, Redis, or log shipping.

## Inventory before this change

| Area | Existing signal | Gap |
| --- | --- | --- |
| HTTP | Express default behavior; no request log | No correlation, duration, route class, or status family |
| Errors | Controller messages; no global handler | Unhandled errors could leak; no structured 5xx event |
| Auth | HTTP 401 bodies | No operational event besides the status code |
| PostgreSQL | `/health/ready` `SELECT 1` | No timeout classification, no metrics, no startup/shutdown DB close |
| Transactions | Serializable retry in code | No retry/conflict counters |
| Socket.io | None | No accept/reject/disconnect/policy counts; no process-local gauge |
| Steam/Gemini/R2 | `console.log` / thrown Errors | Unstructured, sometimes payload-adjacent; Steam URL contained the API key in memory but must never be logged |
| Release | Health JSON `release.gitSha` / `deploymentId` | Not present on logs or lifecycle events |
| Lifecycle | `listen` + `console.log` | No SIGTERM/SIGINT, no drain, no Prisma/Socket close |
| SLOs | None | No documented SLI mapping |

## Runtime placement

Cross-cutting signals live under `backend/src/platform/observability/`. Product modules do not own logging policy. HTTP middleware is composed in `app.ts`; process lifecycle is composed in `index.ts` and is not installed when tests import `app`.

## Structured logs

Logs are one JSON object per line on stdout.

Stable fields:

| Field | Meaning |
| --- | --- |
| `ts` | ISO-8601 timestamp |
| `level` | `debug` \| `info` \| `warn` \| `error` |
| `event` | Stable event name (`http.request`, `process.ready`, …) |
| `gitSha` | `RAILWAY_GIT_COMMIT_SHA` or `GIT_SHA` |
| `deploymentId` | `RAILWAY_DEPLOYMENT_ID` |
| `requestId` | HTTP correlation id (never a metric label) |
| `method` | HTTP method |
| `route` | Express route template or `unmatched` |
| `status` | HTTP status |
| `durationMs` | Duration |
| `dependency` | `postgresql` \| `steam` \| `gemini` \| `r2` |
| `outcome` | `success` \| `failure` |
| `failureCategory` | Bounded class (`http_5xx`, `timeout`, `rate_limited`, …) |
| `retry` / `retryClassification` | Transaction retry metadata |
| `socketId` | Socket.io id for this process |
| `disconnectReason` | Bounded disconnect class |

Never logged: passwords, JWTs, `Authorization`, credential cookies, provider secrets, API keys, raw bodies, provider payloads, exception messages that may contain SQL or secrets.

Probe routes (`/health`, `/health/ready`, `/metrics`) log at `debug`.

## HTTP correlation

- Header: `X-Request-Id`
- Incoming values must match `^[A-Za-z0-9._-]{1,64}$`; otherwise a UUID is generated
- Echoed on the response
- Included in structured logs and generic 500 bodies as `requestId` only
- Socket.io uses `socket.id` plus actor identity in application code; HTTP request ids are not applied to unrelated realtime events

## Metrics

`GET /metrics` returns Prometheus text for **this process**. Cardinality is bounded by allow-listed label values.

| Metric | Labels |
| --- | --- |
| `http_requests_total` | `method`, `route`, `status_class` |
| `http_request_errors_total` | `method`, `route`, `status_class` |
| `http_request_duration_ms` | `method`, `route` |
| `http_requests_in_flight` | none |
| `readiness_state` | none (1 ready, 0 unavailable) |
| `db_transaction_retries_total` | none |
| `db_transaction_conflicts_total` | none |
| `dependency_requests_total` | `dependency`, `outcome`, `failure_category` |
| `dependency_request_duration_ms` | `dependency` |
| `socket_connections_accepted_total` | none |
| `socket_connections_rejected_total` | none |
| `socket_disconnects_total` | `reason_class` |
| `socket_policy_failures_total` | `event`, `code` |
| `socket_connections_active` | none; `io.engine.clientsCount` on this process |
| `outbox_events_claimed_total` | `event_type` |
| `outbox_events_completed_total` | `event_type` |
| `outbox_events_retryable_total` | `event_type`, `failure_category` |
| `outbox_events_terminal_total` | `event_type`, `failure_category` |
| `outbox_lease_recovered_total` | `event_type` |
| `outbox_processing_duration_ms` | `event_type`, `outcome` |
| `outbox_backlog` | none |
| `outbox_worker_up` | none |

`event_type` is allow-listed (`messaging.message.created` or `other`). `failure_category` includes `poison`. Forbidden as labels: user id, request id, message/conversation/community/event/aggregate id, raw URL, nickname, error message, provider payload.

`route` is the Express pattern (`/users/:userId`), never the concrete URL.

## Health and lifecycle

- `/health`: liveness only. Railway or a load balancer can use it to see that the Node process answers.
- `/health/ready`: PostgreSQL readiness with a 1.5s timeout (overridable via `READINESS_TIMEOUT_MS`), 5s cache, coalesced in-flight probes, no error details.
- Startup logs sanitized configuration booleans and release identity, then `process.ready` after listen on `0.0.0.0:$PORT`.
- SIGTERM/SIGINT start a single shutdown: stop embedded workers, force leftover HTTP connections closed, close Socket.io, close the HTTP server, disconnect Prisma, 10s bound, `process.shutdown.completed` or `process.shutdown.failure`. `/health/ready` returns 503 once shutdown has started.
- Dedicated worker lifecycle events: `outbox.worker.startup`, `outbox.worker.ready`, `outbox.worker.shutdown`.

## Production triage

See [railway-production-note.md](railway-production-note.md) and [slo.md](slo.md).
