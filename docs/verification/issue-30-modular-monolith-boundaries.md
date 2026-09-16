# Issue #30 verification: modular-monolith boundaries

**Owning issue:** [GitHub Issue #30](https://github.com/Bruno2K/team-scrapbook/issues/30)

**Base:** `b0b15b17908211f33200422c91f865bf14d45293` (`main`, tag `v0.2.0`)

**Branch:** `arch/modular-monolith-boundaries`

## Scope and behavior evidence

- Actual static imports and Prisma call sites were inventoried before defining target ownership; the conclusions are recorded in [`modular-monolith.md`](../architecture/modular-monolith.md).
- Notifications were selected because the slice had six cross-boundary consumers and mixed application behavior, Prisma, HTTP, presentation, and process-global realtime delivery while retaining a bounded blast radius.
- Before: callers imported `services/notificationService.ts`; the service queried Prisma and invoked `notificationEmitter.ts`; HTTP behavior lived in global controller/view files and notification routes were mixed into `userRoutes.ts`.
- After: callers import `modules/notifications/index.ts`; application orchestration depends on a repository and delivery contract; Prisma and Express are adapters; `index.ts` is the only public entrypoint; Socket.io registers a best-effort delivery adapter in the composition root.
- No endpoint path, status, Portuguese response message, pagination rule, notification JSON field, persistence order, or best-effort delivery behavior changed.
- Public commands use explicit contract signatures; persistence-shaped `NotificationRecord` values remain internal to the module.
- No schema, migration, external dependency, frontend behavior, deployment configuration, authentication semantics, or product feature changed.

## Focused verification

- `npm run architecture:check` in `backend`: pass. The checked-in source has no guarded boundary violation.
- `npm run test:unit -- --reporter=verbose` in `backend`: pass, 6 files / 18 tests.
  - Four notification application tests cover persistence plus unchanged delivery DTO, best-effort delivery failure, pagination, and join-request cleanup.
  - Three architecture tests cover the real tree plus controlled failures for cross-module internal access and application-layer Prisma access.
- Disposable PostgreSQL 16:
  - `npm run db:test:prepare`: pass; migration applied, status current, no schema drift.
  - `npm run test:integration -- --reporter=verbose`: pass, 7 files / 23 tests.
  - Notification adapter coverage proves authentication, response shape, unread listing, allowed owner updates, and a denied cross-user update that returns 404 and leaves the foreign record unread.
  - `npm run db:test:down`: pass; disposable container, network, and volume removed.

## CI-equivalent verification

Frontend job sequence:

- `npm ci`: pass; local Node 20.10.0/npm 10.2.3 emitted the expected engine mismatch against the pinned Node 22.23.2/npm 10.9.8.
- `npm run lint`: pass with 17 pre-existing warnings and zero errors.
- `npm run typecheck`: pass.
- `npm run test:ci`: pass; 2 files / 6 frontend tests and 4 smoke-script tests.
- `npm run build`: pass; retained the known 645.21 kB chunk warning and stale browsers-data warning.

Backend unit/build job sequence:

- `npm ci`: pass; the same local-versus-pinned engine warning was emitted.
- `npm run db:generate`: pass with Prisma Client 6.19.2.
- `npm run architecture:check`: pass.
- `npm run typecheck`: pass.
- `npm run test:unit`: pass, 6 files / 18 tests.
- `npm run build`: pass.

The backend PostgreSQL job is represented by the focused disposable-database results above and used the repository's guarded `team_scrapbook_test` database.

## Controlled guard failure

`tests/unit/architectureGuard.test.ts` supplies a synthetic chat application source that imports `notifications/persistence/prismaNotificationRepository.js`. The guard reports the forbidden internal-module dependency. A second synthetic application source imports `db/client.js` and is rejected because Prisma belongs in module persistence adapters. These cases run without weakening or temporarily breaking the checked-in source tree.

## Independent review

- **Tester / Failure Analyst:** found that the initial owner-read test could not detect removal of the `userId` predicate. A second user and foreign notification were added; the strengthened integration test proves a 404 and unchanged `readAt`. The rerun passed 23/23 tests. Final re-review found no unresolved blocker.
- **Architecture / Security Reviewer:** found that the initial entrypoint inferred `Promise<NotificationRecord>` and leaked an internal persistence-shaped type. The public facade now declares `createNotification(...): Promise<void>` plus explicit delete/delivery signatures. Generated declarations, architecture check, typecheck, unit tests, build, and diff check confirmed the correction. Final re-review found no unresolved blocker.
- Residual review risks are the intentionally syntactic/migrated-module scope of the guard, legacy Socket.io/AI bypass debt, and permissive notification type/payload correlation inherited from existing behavior.

## Remaining architecture debt intentionally deferred

- Legacy controllers/services/views still have direct Prisma and cross-feature implementation imports; migrate only under owning issues.
- `socket.ts` still performs direct presence/conversation Prisma operations and chat/AI orchestration. Only notification delivery was moved to an adapter in this slice.
- AI action orchestration still imports internal product services and Prisma; it must adopt public module contracts before future AI gateway work.
- The physical `User` model is touched by identity, profile, relationship recommendations, Steam linking, and presence paths; target write ownership is documented but not yet separated.
- Multi-module transaction propagation, retries, and idempotency semantics are deferred to the later transactional work item.
- The import guard covers static TypeScript imports under migrated `src/modules`; it is not a semantic model-access analyzer and intentionally does not fail existing legacy debt.
- The checked-in OpenAPI remains partial and does not describe the notification endpoints; closing general API documentation drift is outside this architecture-boundary issue.
- Socket.io rooms, notification delivery, and presence remain process-local; distributed delivery infrastructure is explicitly out of scope.
