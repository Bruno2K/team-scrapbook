# ADR: Incremental backend modular-monolith boundaries

**Owning issue:** [GitHub Issue #30](https://github.com/Bruno2K/team-scrapbook/issues/30)

**Status:** Accepted

## Context

The backend is deployed as one process and one PostgreSQL database, but feature ownership is obscured by global `controllers`, `services`, `views`, and a shared Prisma client. Actual imports show controllers and Socket.io querying Prisma directly, services importing other feature services, and AI orchestration calling internal implementations. A repository-wide rewrite would create risk without product benefit, while leaving the structure implicit makes later correctness and security work harder.

## Decision

Keep a single deployable modular monolith and migrate feature slices incrementally under `backend/src/modules/<module>` when owned work justifies it. Each migrated module has one `index.ts` public entrypoint. Internals may separate application, domain/policy, persistence, and transport adapters only where the separation carries a real responsibility.

New cross-module calls target public entrypoints. Application/domain code does not depend on Express or Socket.io. Prisma is confined to a module's persistence adapter. Composition roots may register concrete adapters, while transports call application use cases and do not duplicate policy. Legacy files may remain until an owning issue safely migrates them; new work must not deepen legacy coupling.

Notifications are the first migrated slice. Its public entrypoint exposes notification commands, delivery registration, public contract types, and the existing HTTP router. Its application service depends on a repository contract and a best-effort delivery function; Prisma and Express remain adapters.

## Alternatives considered

- **Repository-wide layered-folder rewrite:** rejected because it produces a large behavior-preservation risk and folder churn before later milestone work needs each boundary.
- **Microservices or an internal service bus:** rejected because the product has one runtime/database and Issue #30 explicitly excludes distributed-system infrastructure.
- **Documentation only:** rejected because it would not prove the dependency rules or prevent immediate regression.
- **Authentication as the first slice:** rejected to avoid mixing this boundary change with the next milestone's security-hardening scope.

## Consequences / tradeoffs

- **Positive:** migrated modules have explicit ownership, narrow reviewable contracts, testable application logic, and enforceable import direction.
- **Positive:** later transaction, security, realtime, and AI work can target named boundaries without requiring a big-bang rewrite.
- **Negative:** legacy and modular structures coexist temporarily, so the architecture document must distinguish current state from target rules.
- **Negative:** the lightweight guard enforces migrated-module rules, not all semantic data ownership across legacy services.

## Follow-up implications

- Migrate another slice only under its owning issue and add contracts based on actual collaboration needs.
- Later transaction/idempotency work must define transaction-aware module persistence without allowing callers to bypass module policy.
- Later realtime work should remove remaining direct Prisma and internal-service calls from `socket.ts`.
- Later AI-platform work should route AI-managed actor actions through the same public application contracts as human-triggered actions.
