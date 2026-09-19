# Spec: Complete HTTP API contracts and CI drift detection

**Owning issue:** [GitHub Issue #40](https://github.com/Bruno2K/team-scrapbook/issues/40)

## Problem / context

The composed Express application in `backend/src/app.ts` exposes the public HTTP product surface. `backend/src/openapi.ts` previously documented only a subset, so route additions or removals could ship without a contract update. Milestone 1 / Work Item 1.1 requires an explicit HTTP contract and a gate that fails on structural drift.

## Objective

Make every current public HTTP METHOD+PATH explicit in the checked-in OpenAPI document, and fail locally and in CI when the composed runtime surface and that document disagree structurally.

## Requirements

- Runtime behavior is authoritative when existing OpenAPI text is stale.
- Every public product HTTP METHOD+PATH on the composed Express app is represented in OpenAPI, or excluded with an explicit rationale.
- Swagger UI and the raw spec URL are documentation surfaces, not product routes. They are excluded from product-route drift.
- The drift check derives the HTTP surface from the composed application. It must not use a hand-maintained route list as source of truth.
- Structural comparison is METHOD + normalized PATH. Express `:param` and OpenAPI `{param}` are equivalent.
- Behavioral accuracy is documented proportionally (auth requirement, representative request validation, representative status codes). Nested response-view fidelity is not a completeness gate.
- Auth: bearer-required routes document `bearerAuth`. Optional-auth GET routes must not be marked as mandatory bearer. Steam callback is a query `link_token` + SPA redirect, not a bearer JSON endpoint.
- No runtime, auth-semantics, schema, or session redesign.

## Out of scope

- Browser-session redesign, refresh tokens, OAuth/OIDC, MFA/passkeys.
- Socket.io event contracts, distributed realtime, Redis/BullMQ.
- Database/migrations, generated clients, OpenAPI/framework migration.
- Complete nested response-model rewrite.
- Milestone 2 work.

## Contracts / invariants

- Runtime implementation remains the behavioral source of truth.
- OpenAPI is the checked-in HTTP contract for METHOD, PATH, and documented auth semantics.
- Public contract evolution follows [`docs/architecture/http-api-compatibility.md`](../architecture/http-api-compatibility.md): prefer additive changes; removals/renames/incompatible request or response changes need an owning Issue and compatibility analysis; OpenAPI, clients, and tests change together; the drift gate must not be bypassed; deprecation is explicit when compatibility warrants it.
- Documentation-only Swagger surfaces stay excluded from product-route comparison.

## Non-functional requirements

Deterministic local command (`npm run contract:check` in `backend`) and the same command in the backend unit/build CI job. No new runtime dependency.

## Failure modes

- Runtime METHOD+PATH missing from OpenAPI → check fails (`missing in OpenAPI`).
- OpenAPI METHOD+PATH missing from runtime → check fails (`missing in runtime`).
- Exclusion that matches no observed documentation/runtime path → check fails (`invalid exclusion`).
- Path-parameter syntax mismatch without normalization → false drift. Mitigation: normalize `:id` and `{id}`.
- Broad filtering of Swagger layers hiding product routes. Mitigation: prefix-scoped documented exclusions only.

## Impact

- **Data / migration:** not applicable.
- **Frontend:** path/method compatibility verification only; no generated client; no session-model change.
- **Backend:** OpenAPI, contract check, focused tests, CI command. Runtime handlers unchanged.
- **Infrastructure:** CI step only.
- **AI:** document existing `POST /ai-actions/generate` human-session 403. Do not redesign the route.

## Test strategy

- Isolated unit tests for extraction, normalization, exclusions, and drift diagnostics.
- Guard test against the composed app and checked-in OpenAPI.
- Representative HTTP integration evidence for public, bearer-required, optional-auth, mutations, Steam callback redirect/query-token, AI 403, and `GET /api-docs.json`. Reuse existing tests where they already suffice.

## Rollout / rollback

Documentation and CI only. Revert the PR to remove the gate. No database rollback.

## Acceptance criteria

- [ ] Every current public HTTP METHOD+PATH is in OpenAPI or explicitly excluded with rationale
- [ ] No known structural runtime/OpenAPI drift remains
- [ ] `npm run contract:check` is deterministic and CI-enforced
- [ ] Representative contract tests exist
- [ ] Stale known operations (`GET /users/friends`, `POST /feed`, `/scraps`, Steam callback, AI action) match runtime
- [ ] Frontend callers remain path/method compatible
- [ ] Architecture check, unit/build, and required CI remain green
- [ ] Runtime semantics unchanged

## Expected evidence

Issue #40, this spec, updated OpenAPI, contract check + unit guard, representative HTTP tests, CI backend-unit placement, independent Tester and Architecture/Security reviews, remaining schema-fidelity limitations recorded honestly.

## Remaining risks

- Express 4 router-stack inspection can change across Express majors; the extractor is isolated and tested.
- Nested serialized views are documented proportionally, not field-complete.
- Socket.io events remain outside this HTTP contract.
