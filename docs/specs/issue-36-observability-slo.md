# Spec: Observability SLOs and lifecycle

**Owning issue:** [GitHub Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)

## Behavior

The API process emits structured JSON logs, HTTP correlation via `X-Request-Id`, Prometheus text at `/metrics`, dependency/realtime counters, distinct liveness/readiness, and bounded graceful shutdown. SLOs are documented in [`docs/operations/slo.md`](../operations/slo.md) and must be computable from those signals.

## Invariants

- Secrets, tokens, and payloads never appear in logs or metric labels.
- Metric labels stay in allow-lists; request ids are headers/logs only.
- `/health` does not query PostgreSQL; `/health/ready` does, with timeout and no details.
- Socket counts are process-local.
- Importing `app` in tests does not install signal handlers or listen.
- Shutdown runs at most once and cannot wait forever.

## Failure modes

- Invalid `X-Request-Id` → generated UUID, still bounded.
- PostgreSQL down or slow → readiness 503, `readiness_state=0`.
- Unhandled HTTP exception → 500 `{ message, requestId }` without the exception text.
- Shutdown timeout → `process.shutdown.failure` and non-zero exit when started as the process.

## Acceptance

Controlled tests cover correlation, redaction, metrics cardinality, readiness failure/timeout, dependency classification, shutdown bounds, and release identity. Architecture/security/transaction tests remain green.
