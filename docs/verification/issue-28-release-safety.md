# Issue #28 release-safety evidence

Scope: GitHub Issue #28, based on `main` merge commit `c61dfb7` (PR #27). The Issue supplied
sufficient contracts and acceptance criteria, so no separate Context Pack or Spec was created.

## Implementation evidence

- Existing **Pull Request Quality Gate** remains the release-quality source. Its frontend job now
  also runs the repository smoke-script tests; CI logic was not duplicated in the manual workflow.
- `scripts/smoke.mjs` checks the frontend fingerprint and module entry, embedded API base, backend
  process health, browser-origin CORS coherence, PostgreSQL readiness, and exact frontend/backend
  deployment SHA.
- `.github/workflows/smoke.yml` is manual only. Release evidence must run from `main`; production
  targets use HTTPS and must match protected GitHub Environment variables.
- `/health` remains process health. `/health/ready` executes a detail-free, read-only `SELECT 1`,
  with five-second per-process caching and concurrent-probe coalescing.
- `docs/operations/release-safety.md` contains the release gate, evidence model, Vercel/Railway
  rollback steps, legacy rollback limitation, database policy, flag policy, and protection settings.

## Verification

Final local results on 2026-09-15:

- Lint: pass with zero errors and the 17 already-recorded warnings.
- Frontend typecheck: pass.
- Frontend tests: 2 files, 6 tests pass.
- Smoke tests: 4 pass, covering healthy targets, configuration mismatch/non-zero CLI exit,
  process-health failure, and database-readiness failure.
- Frontend production build: pass. Existing stale browser-data and large-chunk warnings remain.
- Prisma generation: pass.
- Backend typecheck and production build: pass.
- Backend unit tests: 4 files, 11 tests pass, including detail-free readiness failure and concurrent
  probe coalescing.
- Disposable PostgreSQL 16: migration deploy/status/schema-drift checks pass; 6 integration files and
  20 tests pass; container and volumes removed after verification.
- `git diff --check`: pass.

## Independent review

Tester / Failure Analyst initially found that optional SHA evidence could permit a false-green mixed
deployment. The workflow now requires a full target SHA, both deployments must report it, production
URLs are protected, controlled failure cases run in CI, and direct tag-push bypass is documented.
Final re-review reported no blocker.

Architecture / Security initially found the same identity gap, insufficient frontend asset proof,
unbounded readiness queries, invalid OpenAPI nullability, missing protection evidence, and a legacy
rollback verification gap. Corrections require trusted-main workflow provenance, protected HTTPS
production targets, same-origin module fetch/redirect checks, bounded readiness probes, valid OpenAPI
3.0 nullability, protection evidence, and a reduced-assurance legacy incident path that cannot
qualify a release. Final re-review reported no blocker and no secret exposure.

## Main protection status

The required exact check names and manual settings are documented. The unauthenticated GitHub API
returned HTTP 401 for the protection-status endpoint, so actual protection could not be verified or
changed. A human administrator must verify/apply `main` protection, configure the production GitHub
Environment variables `SMOKE_FRONTEND_URL` and `SMOKE_BACKEND_URL`, and optionally create a `v*`
tag ruleset. These are administrative human gates.

## Milestone 0 status

Issues #20, #22, #24, and #26 are closed. Issue #28 remains open until this pull request is merged.
The final candidate's GitHub CI and full production smoke run cannot exist before the commit is
pushed, deployed, and the manual workflow is run. Therefore `v0.2.0` is not yet ready for approval.
After merge, record the exact merged `main` SHA, provider deployment identities, migration/CI links,
full production smoke run, protection status, and remaining risk before requesting the separate tag
approval.
