# Backend modular-monolith boundaries

**Owning issue:** [GitHub Issue #30](https://github.com/Bruno2K/team-scrapbook/issues/30)

**Decision:** [ADR 0001](../adr/0001-modular-monolith-boundaries.md)

This document records both the dependency map observed at `b0b15b17908211f33200422c91f865bf14d45293` and the incremental target. It does not claim that legacy code already satisfies every target rule.

## Current-state dependency findings

The inventory was produced from static imports and Prisma call sites with:

```text
rg -n '^import|require\(' backend/src backend/tests --glob '*.ts'
rg -n 'prisma\.|\$transaction|Prisma' backend/src --glob '*.ts'
rg -n 'from "\./.*Service\.js"|from "\.\./services/.*Service\.js"' backend/src --glob '*.ts'
```

Runtime paths establish these facts:

- `app.ts` composes global route files; routes call global controllers; controllers commonly orchestrate multiple services and sometimes Prisma directly.
- Authentication/identity is split across `authService`, `authController`, `middleware/auth`, and direct user reads. `auth` middleware reads Prisma and then calls the auth service for JWT verification.
- Users/profiles, friendships, blocking, recommendations, presence, and profile projections share `userService`, `userController`, `socket.ts`, and the `User`, `Friendship`, `FriendshipRequest`, and `BlockedUser` models. `userService` also reads community membership and sends notifications.
- Feed, scraps, comments, reactions, and attachment metadata span `feedService`, `scrapService`, `commentService`, `reactionService`, their controllers/views, and several related Prisma models. `feedController` directly queries Prisma and combines several services.
- Communities, roles, invites, requests, and community posts are concentrated in `communityService`, but that service imports relationship and notification implementations directly.
- Messaging uses `chatService` plus HTTP and Socket.io handlers. The handlers query `Conversation` directly and create notifications; the service imports relationship policy and Gemini code directly.
- Notifications previously combined Prisma, pagination, cleanup, and realtime emission in a global service plus a process-global callback. Callers imported that implementation directly from friendships, communities, scraps, chat HTTP, and Socket.io.
- Steam consists of controller orchestration plus `steamService` and `steamSyncService`; both the controller and sync service access Prisma.
- Storage/media uses `uploadService` for R2 while content/profile records persist returned metadata and URLs.
- AI actions use `aiActionsService`, which directly accesses Prisma and internal feed, scrap, comment, reaction, community, and Gemini services. AI chat behavior also lives inside `chatService`.
- Cross-cutting HTTP, validation, auth middleware, errors, configuration, logging, Prisma, and composition are global. There is no general error boundary or structured logging abstraction; `db/client.ts` is globally importable.
- `socket.ts` is a parallel orchestration path for chat and presence: it verifies JWTs, writes `User.online`, reads conversations, calls chat/AI services, creates notifications, and emits events.

The result is a functioning monolith with implicit feature ownership and many legal TypeScript import paths into implementation details.

## Target modules and ownership

The target is a responsibility map, not an instruction to create every folder immediately.

- **identity:** credentials, JWT issuance/verification, and authenticated identity. It owns authentication policy and the credential-facing portion of `User`; it does not own profiles, relationships, or product authorization.
- **profiles:** public user profile fields, preferences, pins, avatar/profile media references, and profile lookup contracts. The physical `User` row is shared during transition, but writes are owned by explicit profile or identity operations.
- **relationships:** friendships, friend requests, blocking, and relationship checks such as `canChatWith`. It owns `Friendship`, `FriendshipRequest`, and `BlockedUser`.
- **content:** feed items, scraps, comments, reactions, and content attachment metadata. It owns `FeedItem`, `PostComment`, reaction tables, and `ScrapMessage`/`ScrapMessageReaction`.
- **communities:** communities, membership, roles, invites, join requests, and community-post authorization. It owns `Community`, `CommunityMember`, `CommunityInvite`, and `CommunityJoinRequest`; content records remain content-owned.
- **messaging:** conversations, messages, messaging eligibility orchestration, typing, and presence use cases. It owns `Conversation` and `ChatMessage`; realtime is an adapter.
- **notifications:** persisted notifications, user notification queries/read state, cleanup, and delivery output. It owns `Notification` and is the first implemented module.
- **steam integration:** Steam identity resolution and synchronization adapters. It owns Steam API mapping and the `UserSteamGame`/`UserSteamAchievement` persistence surface; linking a Steam identity uses an explicit profile/identity operation.
- **media storage integration:** upload validation, object keys, signing, and R2 transport. It does not own product records that refer to uploaded media.
- **AI integration/orchestration:** Gemini transport and automated action scheduling. It owns no bypass into product data; product mutations go through the same module use cases and policies as human actors.
- **platform:** application composition, configuration parsing, database client construction, common HTTP middleware, and genuinely cross-cutting primitives. It must not contain product policy or miscellaneous feature helpers.

## Dependency rules

Allowed direction for migrated modules:

```text
composition root -> module public entrypoint / concrete transport adapter
HTTP or Socket.io adapter -> module application use case
application -> own domain/policy + own persistence port + another module public entrypoint
domain/policy -> domain values and types only
persistence adapter -> Prisma client + module-owned repository contract/models
integration adapter -> external SDK + application-facing port
```

Disallowed:

- importing another module below `modules/<name>/index.ts`;
- importing Express or Socket.io from application/domain code;
- importing Prisma or `db/client` from module application/domain/transport code;
- querying another module's models instead of using its public lookup/check/command contract;
- placing product rules in routes, controllers, Socket.io listeners, AI schedulers, or shared infrastructure;
- exporting a broad barrel of module internals or introducing a generic internal RPC/event bus.

Legacy code may keep existing paths until an owning issue migrates it. Any touched cross-module dependency should move toward the public contract, and no change should add a new direct dependency on a migrated module's internals.

## Public contracts

Public entrypoints live at `modules/<name>/index.ts`. They expose the smallest command, query, policy check, DTO/type, or adapter registration needed by real consumers. Internal repository implementations, framework controllers, and domain helpers are not public.

The implemented notification contract exposes:

- `createNotification` for product modules that need persisted user notification delivery; it is a command returning no persistence record;
- `deleteByJoinRequestId` for the community workflow's existing cleanup need;
- `setNotificationDelivery` for the process composition root to attach Socket.io delivery;
- `notificationRoutes` for Express composition without exposing controllers;
- notification input and delivery types.

Likely future contracts, created only with an owning use case, include profile summaries, relationship authorization checks, community membership/role checks, messaging commands, and content/media metadata. They are not pre-built in this issue.

## Adding a use case

1. Name the owning module and models/policies it changes.
2. Put HTTP, Socket.io, scheduled AI, or integration parsing in an adapter.
3. Put orchestration in application code and policy without framework types where practical.
4. Keep Prisma in the module persistence adapter; request cross-module data through a public contract.
5. Export only the needed operation/type from the module `index.ts`.
6. Add focused application tests, adapter/integration coverage when behavior crosses a transport or database, and run `npm run architecture:check --prefix backend`.

## Prisma and transaction ownership

- A module may use direct Prisma calls inside its own persistence adapter for models it owns. Transport, application, domain, AI, and realtime adapters do not use Prisma directly in migrated modules.
- Cross-module reads use a public query or policy contract; callers do not import another module repository or Prisma model access.
- The current single schema and Prisma client remain shared infrastructure. Physical schema location does not grant every module write ownership.
- A future transaction involving one module is orchestrated by that module's application use case.
- A future transaction involving multiple modules belongs to the application workflow that owns the invariant. Participating modules must expose transaction-aware persistence operations or an explicit coordinated contract; the workflow must not reimplement their policies with raw Prisma calls.
- Exact transaction propagation, retry, and idempotency semantics are intentionally deferred to the later milestone issue.

## Realtime boundary

Socket.io authenticates/parses events, invokes application use cases, and emits returned delivery DTOs. It does not own a second implementation of messaging, notification, relationship, or presence policy.

The representative slice now registers Socket.io as the notification module's best-effort delivery adapter. Notification persistence and serialization remain inside the module. Remaining direct chat/conversation/presence Prisma work in `socket.ts` is recorded debt, not silently treated as compliant.

## AI actor boundary

An AI-managed user is a normal actor identity. Automated execution may choose when and what to request, but it calls the same public module use cases, supplies the actor identity, and is subject to the same membership, relationship, content, and authorization policies. Gemini is an integration adapter, not a trusted route around policy or persistence ownership. Migrating the SDK, creating a provider gateway, or building evaluations is outside Issue #30.

## Incremental enforcement

`npm run architecture:check --prefix backend` scans checked-in backend TypeScript imports. It rejects cross-module internal imports, Express/Socket.io dependencies from module application/domain code, and Prisma dependencies outside module persistence adapters. The scope intentionally starts at `src/modules`; legacy debt remains visible and is migrated issue by issue.
