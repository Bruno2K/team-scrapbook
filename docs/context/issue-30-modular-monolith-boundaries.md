# Context Pack: Define modular monolith boundaries and contracts

## Owning issue

[GitHub Issue #30](https://github.com/Bruno2K/team-scrapbook/issues/30)

## Exact objective

Define enforceable incremental backend module boundaries and prove them by moving notifications behind a public contract without changing product behavior.

## Known facts

- The backend is one Express/Socket.io process with Prisma as its only database client; see [`docs/architecture/repository-baseline.md`](../architecture/repository-baseline.md).
- Runtime imports, not the legacy controller/service folder names, show direct cross-feature service calls and Prisma access from controllers, middleware, services, and Socket.io.
- Notifications are called by friendships, communities, scraps, chat HTTP, and chat Socket.io and previously combined Prisma access, delivery registration, HTTP handling, and presentation in global folders.
- Issue #30 excludes transaction redesign, security redesign, distributed Socket.io, observability, AI-provider work, microservices, and product features.

## Read first

1. [`backend/src/modules/notifications/index.ts`](../../backend/src/modules/notifications/index.ts).
2. [`docs/architecture/modular-monolith.md`](../architecture/modular-monolith.md).
3. [`docs/adr/0001-modular-monolith-boundaries.md`](../adr/0001-modular-monolith-boundaries.md).
4. [`backend/scripts/checkArchitecture.ts`](../../backend/scripts/checkArchitecture.ts).

## Read only if needed

- `backend/src/services/userService.ts`, `communityService.ts`, `chatService.ts`, `aiActionsService.ts` — current cross-feature dependency examples.
- `backend/src/socket.ts` — current realtime bypass debt and notification adapter call path.
- `backend/prisma/schema.prisma` — physical model and relation details.
- `backend/src/openapi.ts` and touched integration tests — externally visible HTTP behavior.

## Probably irrelevant

- Frontend restructuring, deployment topology changes, new providers, schema migrations, authentication redesign, and future milestone implementation.

## Contracts / invariants affected

- Existing notification HTTP URLs, status codes, messages, pagination, and JSON shapes remain unchanged.
- Notification persistence completes before best-effort realtime delivery; delivery failure does not fail creation.
- Cross-module notification callers use only `modules/notifications/index.ts`.

## Current known risks

- Most features remain in the legacy global folders and are migrated only when owned work justifies it.
- Socket.io still contains direct chat/presence persistence and policy orchestration outside the representative notification delivery path.
- Several Prisma models are currently touched by multiple legacy services; target ownership is documented but not mechanically enforced outside migrated modules.

## Required verification

- `npm run architecture:check --prefix backend` — checked-in module imports obey the enforced rules.
- `npm run test:unit --prefix backend` — application behavior and controlled guard failures pass.
- `npm run test:integration --prefix backend` with the disposable PostgreSQL URL — notification HTTP behavior and all persistence integration tests pass.
- Repository CI-equivalent lint, typecheck, tests, builds, migration checks, and `git diff --check`.
- Independent Tester/Failure Analyst and Architecture/Security reviews of the final diff and evidence.

## Expected artifacts / evidence

- Target architecture and dependency inventory, accepted ADR, representative module implementation, import guard, focused tests, verification record, and Issue-closing PR.

## Stop conditions

- Issue #30 acceptance criteria are met, required checks and reviews have no blocker, and the PR is open but not merged.

## Escalation triggers

Stop and surface a blocker if the change would require a schema migration, authentication semantic change, production configuration, external credentials, or scope expansion into later milestone work.
