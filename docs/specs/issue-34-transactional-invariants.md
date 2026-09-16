# Spec: transactional invariants and idempotency

**Owning issue:** [GitHub Issue #34](https://github.com/Bruno2K/team-scrapbook/issues/34)

## Problem / context

The current mutation paths mix precondition reads, multiple writes, durable notifications, and
best-effort realtime/provider effects. Several paths already use Prisma transactions, but ownership,
retry classification, and post-commit behavior are inconsistent. This spec records the actual-code
inventory and the focused Milestone 1 hardening slice.

## Mutation and invariant inventory

- **Relationships (`userService`):** friend request creation writes a request then a notification;
  acceptance writes `Friendship` and updates `FriendshipRequest`; blocking removes friendship and
  requests then upserts `BlockedUser`. Authorization is actor/recipient ownership plus the Issue #32
  bidirectional block policy. Acceptance and block race today, and notification writes are not
  deduplicated.
- **Scraps/content (`scrapService`, `commentService`, `reactionService`):** scrap creation writes
  `ScrapMessage` then the controller persists a notification; reactions use database upserts and
  composite uniqueness; comments are single writes. Upload/R2 happens before product metadata is
  submitted. A committed scrap can currently be reported as failed if notification persistence fails.
- **Messaging (`chatService`, HTTP controller, Socket.io):** a message insert and conversation
  activity update are separate writes, followed by notification persistence, Socket.io delivery, and
  optional Gemini work. HTTP/network retry can duplicate messages and notifications. Conversation
  uniqueness protects only conversation creation.
- **Communities (`communityService`):** create+owner membership, join/leave+member count,
  invite acceptance, and join approval already use transactions. Precondition reads and transaction
  writes are not uniformly conditional, so concurrent accept/approve operations can surface raw
  uniqueness failures. Invite/join notifications are post-write and not deduplicated.
- **Notifications (notifications module):** persistence precedes process-local Socket.io delivery;
  realtime failure is already swallowed. Durable notification creation has no logical dedupe key.
- **Steam (`steamController`, `steamSyncService`):** provider calls are outside transactions, but
  replace-style delete/create loops for games and achievements can leave partial snapshots. This is
  high risk but intentionally deferred because its provider/snapshot contract differs from the two
  representative families.
- **AI actions (`aiActionsService`, `chatService`):** Gemini calls occur before product commands and
  AI actors reuse Issue #32 policy surfaces. Random batch actions are intentionally independently
  committed. AI chat reply generation is post-commit and best effort.
- **Profile/media metadata:** profile writes are single-row updates. R2 upload and product record
  persistence are not atomically durable across systems and require future compensating cleanup or an
  outbox/worker.

## Selected representative flows and invariants

### Relationship acceptance and blocking

- Friendship rows always store the canonical ordered user pair.
- A successful block commit leaves one directed `BlockedUser` row and no friendship or pending
  request in either direction for the pair.
- Friend-request creation/reactivation and blocking use the same relationship-owned Serializable
  protocol, so a racing request cannot commit beside a block. Its notification is post-commit.
- A friend-request acceptance is authorized only for its recipient and only from `PENDING`.
- Duplicate acceptance returns the already-applied outcome when the accepted request and canonical
  friendship agree; it does not create another friendship.
- Concurrent acceptance and blocking cannot commit both a friendship and a blocking relation.
- A failure after friendship insertion but before request transition rolls back the friendship.

### Message send and notification

- The message insert and conversation `updatedAt` mutation commit atomically.
- The Issue #32 participant/friend/block policy is checked before persistence and is not bypassed by
  HTTP, Socket.io, or AI actors.
- `POST /chat/messages` accepts an optional `Idempotency-Key` header. Keys are scoped to the
  authenticated sender, limited to 128 visible ASCII characters, and retained with the message (no
  expiry in Milestone 1).
- Reusing the same sender/key with the same canonical payload returns the original message. Reusing
  it with a different payload returns a controlled conflict. Requests without a key remain
  intentionally non-idempotent and must not be retried automatically.
- Replay lookup happens before current send-policy evaluation because it returns an already
  authorized participant-owned history record rather than performing a new mutation. Issue #32
  explicitly preserves existing conversation history after blocking; new sends still require the
  current friendship/block policy.
- One durable chat notification exists per message via `Notification.dedupeKey`. Notification
  persistence and delivery occur after message commit. Failure does not undo or misreport the
  committed message; a keyed retry can re-attempt the deduplicated notification.
- Socket.io emission and Gemini calls remain post-commit best effort and outside all database
  transactions. No exactly-once delivery claim is made.

## Transaction ownership and propagation

- A one-module command begins its transaction in that module's Prisma persistence adapter, invoked
  by its application use case. Application/domain and transports receive result types, not Prisma.
- Transaction-scoped clients stay inside persistence adapters. Repository operations that must share
  atomic state are grouped behind one explicit method rather than opening nested transactions.
- Cross-module durable notification work is not pulled into the messaging transaction. The caller
  invokes the notification module's public command after commit with a dedupe key.
- Serializable retries are narrow: only Prisma `P2034` transaction conflicts are retried, with a
  fixed small attempt limit. Unique conflicts used for idempotency are resolved by reading the
  winning row; unrelated database errors propagate as internal failures.

## Failure modes

- Exhausted serialization conflict becomes an application conflict, never a raw Prisma response.
- A late relationship write failure aborts every write in that transaction.
- A duplicate message-key race resolves to one message and one durable notification.
- A key/payload mismatch is `409 Conflict` and creates no write.
- A post-commit notification, Socket.io, or Gemini failure leaves committed state intact and is not
  represented as a rollback.

## Impact

- **Data / migration:** nullable forward-safe columns plus unique indexes; existing rows are unchanged.
- **Frontend:** REST creates the idempotency key at the logical-attempt boundary, retains it together
  with the unchanged payload after an ambiguous failure, and clears it only after success. Editing
  the payload starts a new attempt/key. Socket payloads remain compatible and keyless.
- **Backend:** relationship commands and message persistence move behind module application/persistence
  contracts; legacy read paths remain untouched.
- **Infrastructure:** no new service, queue, lock, or runtime dependency.
- **AI:** Gemini stays outside transactions; AI-authored messages use the same policy and persistence.

## Test strategy

- PostgreSQL failure injection after the first transaction write proves scoped visibility and rollback.
- Duplicate and concurrent keyed sends prove one message and one notification.
- Concurrent accept/block execution proves the exclusion invariant and narrow serialization retry.
- HTTP coverage proves replay and key/payload conflict mappings.
- Existing Issue #32 authorization tests, architecture guard, migration drift, and complete repository
  checks remain green.

## Rollout / rollback

The migration is additive and deploys before application code. Application rollback is compatible
with the added nullable columns/indexes. A later schema rollback may drop the indexes and columns only
after confirming no rollback target depends on them; no data backfill or destructive operation is
required.

## Remaining risks / Milestone 2

- Durable eventual delivery of notifications, Socket.io events, Gemini replies, and provider-driven
  work requires an outbox plus worker with retry/dead-letter policy. Milestone 1 intentionally offers
  best-effort post-commit delivery only.
- Steam snapshot replacement needs a separate short transaction after provider fetch plus explicit
  stale-snapshot semantics.
- Community invite/join conditional transitions and targeted notification dedupe remain follow-up
  correctness work; existing transactions are retained without broad refactoring.
- R2 orphan cleanup and durable media-finalization require worker/compensation design.
