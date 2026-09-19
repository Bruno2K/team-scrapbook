# Railway / Vercel operational note

**Owning issue:** [GitHub Issue #36](https://github.com/Bruno2K/team-scrapbook/issues/36)

This note uses repository-recorded deployment evidence. It does not invent an incident.

## What the baseline actually showed

- Issue #20 / operations baseline: the Vercel SPA referenced the Railway API; **Railway `GET /health` returned HTTP 200**. That proved the Node process answered, not that PostgreSQL was ready.
- Architecture baseline: `/health` “proves process reachability, not database health.”
- Technical-debt baseline: `/health` “does not establish PostgreSQL or external-integration readiness.”
- Issue #28 / PR #27 introduced `/health/ready` (`SELECT 1`, coalesced, cached 5s, detail-free 503) and smoke checks that compare Vercel and Railway Git SHAs (`RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`).
- Issue #19 / `backend/RAILWAY.md`: Railway build `npm ci && npx prisma generate && npm run build`, pre-deploy `npx prisma migrate deploy`, start `npm run start`, port 3000.
- CORS: the custom production frontend origin is the coherent browser entry; the Vercel default alias can still be rejected by Railway CORS (recorded debt, not a new outage).

The previous gap was semantic: an operator (or Railway health check pointed only at `/health`) could conclude “the service is fine” while PostgreSQL was down. Smoke after #28 already split the checks; this issue adds logs, metrics, timeouts, lifecycle events, and release identity on those same two meanings.

## How the new signals change diagnosis

| Question | Before | Now |
| --- | --- | --- |
| Is the process alive? | `/health` 200 | Unchanged, plus `process.ready` / `process.shutdown.*` logs |
| Can it take traffic? | `/health/ready` after #28 | Same endpoint, plus `readiness_state`, PostgreSQL dependency metrics, probe timeout class |
| Which release? | Health JSON `release` | Same JSON plus every structured log line |
| Which requests fail? | None | `http.error` / `http.request` with `requestId`, `route`, `status` |
| Latency / in-flight | None | `http_request_duration_ms`, `http_requests_in_flight` |
| Steam / Gemini / R2 | Console strings | `dependency.call` outcome + category, no payloads |
| Socket.io | None | Process-local accept/reject/disconnect/policy counters |
| Deploy stuck | Railway dashboard only | Startup failure log; shutdown timeout log if SIGTERM drain fails |

## Triage workflow

1. Confirm **which** deployment: Railway deployment ID/SHA vs Vercel metadata vs expected Git SHA (smoke).
2. Hit `/health`. If this fails, the process is down or not bound to `$PORT`; inspect Railway deploy logs for `process.startup` / `process.ready` / `process.startup.failure`.
3. Hit `/health/ready`. If liveness is 200 and ready is 503, PostgreSQL (or the bounded probe) is the problem; do not blame Steam/Gemini. Check `dependency_requests_total{dependency="postgresql",outcome="failure"}`.
4. If both health endpoints pass but users fail, inspect `/metrics` and logs for `http.error`, `auth.rejected`, `db.transaction.conflict`, or `dependency.call` failures. Use `X-Request-Id` from the client/response to grep logs.
5. If chat misbehaves on one instance, treat socket gauges as **that replica only**. Multiple Railway replicas are still not a shared Socket.io cluster.
6. If a deploy hangs on replacement, look for `process.shutdown.initiated` without `completed` within 10s (`process.shutdown.failure`).

## Rollback decision points

Use [release-safety.md](release-safety.md) for the human-gated Vercel Instant Rollback and Railway Rollback steps. New observability inputs that support a rollback decision:

- New SHA’s `/health/ready` stays 503 while the previous deployment was ready.
- `http_request_errors_total` rises on the new SHA for critical mutation routes.
- Startup never emits `process.ready`.
- Smoke SHA mismatch between Vercel and Railway.

Rollback is still forbidden when database compatibility is unknown; metrics cannot replace that policy.

## Known limitations

- No log shipping or alerting product is configured in-repo.
- `/metrics` is unauthenticated process data without user identifiers; protect at the edge if the service is public and scraping is undesired.
- No fabricated Railway incident timeline exists in this repository; use provider dashboards plus these signals.
