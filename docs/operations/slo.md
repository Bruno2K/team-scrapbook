# SLOs and SLIs

**Owning issue:** [GitHub Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)

These targets are for the current single-process API. They are intentionally conservative: there is no historical multi-week error-rate evidence, Railway replicas are not aggregated, and frontend/Vercel availability is out of scope.

Evaluation is a rolling 7-day window unless noted. Compute from `GET /metrics` (or equivalent log-derived counters) **per process**, then treat a multi-replica service as unavailable if any serving replica misses its target until global aggregation exists.

## API availability

- **User expectation:** Authenticated and public API calls receive a non-5xx response.
- **SLI:** `1 - http_request_errors_total / http_requests_total` excluding routes `/health`, `/health/ready`, and `/metrics`.
- **Target:** 99.0%
- **Measurement source:** `http_requests_total` and `http_request_errors_total` (`status_class="5xx"`).
- **Window:** 7 days
- **Limitations:** Process-local; probes are excluded; 4xx is not unavailability; a crashed process reports nothing.
- **Error budget:** 5xx responses and process crashes. One failed deploy that serves 5xx consumes budget until rollback or fix.

## Interactive API latency

- **User expectation:** Feed, profile, and similar GETs feel interactive.
- **SLI:** Share of `http_request_duration_ms` observations for `method="GET"` and routes `/feed`, `/users/me`, `/users/:userId` with duration ≤ 500ms.
- **Target:** 90% ≤ 500ms
- **Measurement source:** `http_request_duration_ms` histogram buckets.
- **Window:** 7 days
- **Limitations:** No tracing of slow PostgreSQL statements; cold starts and Steam/Gemini are not these routes; histogram is per process.
- **Error budget:** Observations above 500ms, including GC pauses and saturated event loops.

## Readiness / PostgreSQL availability

- **User expectation:** A deployment that cannot talk to PostgreSQL is not given traffic.
- **SLI:** Share of `/health/ready` checks with HTTP 200 and `checks.database=ready`, equivalently `readiness_state == 1`.
- **Target:** 99.0%
- **Measurement source:** `readiness_state`, `dependency_requests_total{dependency="postgresql"}`, and Railway health logs.
- **Window:** 7 days
- **Limitations:** Cached for 5 seconds; does not prove product-query correctness or connection-pool headroom.
- **Error budget:** Time spent `readiness_state=0`, probe timeouts, and PostgreSQL refusals.

## Critical mutation success rate

- **User expectation:** Writes for scraps, comments, feed posts, chat sends, and community joins complete without server failure.
- **SLI:** `1 - 5xx / total` for `method` in `{POST,PATCH,DELETE}` on `/scraps`, `/comments`, `/feed`, `/chat`, `/communities` route classes, plus chat Socket.io `message` events that are not `FORBIDDEN`/`INVALID_MESSAGE`/`RATE_LIMITED` for already-authenticated sockets.
- **Target:** 99.0%
- **Measurement source:** `http_request_errors_total` / `http_requests_total` for those route classes; `socket_policy_failures_total` is **not** treated as API unavailability (those are authorization/validation). Server disconnects during send consume budget via HTTP/socket errors, not policy counters.
- **Window:** 7 days
- **Limitations:** Client validation 4xx is excluded; transaction conflicts after retries become 5xx/application errors and consume budget; Socket.io counts are process-local.
- **Error budget:** 5xx on those mutations, exhausted transaction conflicts, and dependency 5xx that surface as user-visible write failures.

## What these SLOs are not

- Not 99.999% targets.
- Not a multi-region SLO.
- Not Steam/Gemini/R2 product SLOs (those providers are instrumented for diagnosis only).
- Not a substitute for the [release-safety smoke](release-safety.md), which remains the post-deploy gate.
