# Verification: Issue #34 transactional invariants and idempotency

**Owning issue:** [GitHub Issue #34](https://github.com/Bruno2K/team-scrapbook/issues/34)

## Implemented representative flows

- **Relationships:** friend-request creation/reactivation, acceptance, and blocking now execute through
  a relationship-owned Serializable persistence contract. Bounded retries apply only to Prisma
  `P2034`; known duplicate request insertion is resolved by reading the winning unique row.
- **Messaging:** message insert and conversation activity update share one messaging-owned
  transaction. `POST /chat/messages` supports sender-scoped `Idempotency-Key`; chat notifications
  use a unique logical dedupe key and remain post-commit.

The complete actual-code mutation inventory, invariants, ownership/propagation model, and deferred
risks are recorded in [`docs/specs/issue-34-transactional-invariants.md`](../specs/issue-34-transactional-invariants.md).

## PostgreSQL evidence

The repository-owned PostgreSQL 16 container used
`postgresql://postgres:postgres@localhost:55432/team_scrapbook_test`.

- `npm run db:test:prepare`: pass; two migrations found, no pending migrations, schema current, and
  `prisma migrate diff ... --exit-code` reported no difference.
- `npm run test:integration`: pass; 9 files and 39 tests.
- Injected failure after a transaction-scoped friendship read proved the new row was visible inside
  the transaction and absent after rollback; the request remained `PENDING`.
- Injected failure after a transaction-scoped message read proved the message was visible inside the
  transaction and both message/activity changes rolled back.
- Barrier-controlled accept-vs-block and request-vs-block executions produced real PostgreSQL
  serialization conflicts, exercised bounded retry, and finished with one block plus no friendship
  or pending request.
- Two concurrent HTTP sends with one sender/key/payload returned one `201`, one `200`, the same
  message ID, one message row, and one notification row. Replaying after a block still returned the
  committed participant-history message; a changed payload returned controlled `409`.
- A throwing post-commit hook left the message committed and returned an explicit
  `postCommitEffectFailed` outcome.
- Missing and wrong-recipient friend-request IDs returned the same generic `403` response and caused
  no mutation.

## Complete checks

- Backend Prisma generation: pass.
- Backend typecheck/build: pass.
- Backend unit tests: pass; 9 files and 28 tests.
- Backend architecture guard: pass.
- Frontend lint: pass with the existing 17 warnings and zero errors.
- Frontend typecheck/build: pass; build retained the existing bundle-size/browser-data warnings.
- Frontend unit tests: pass; 3 files and 7 tests, including caller-owned retry-key reuse.
- Smoke tests: pass; 4 tests.
- `git diff --check`: pass; Git emitted only Windows LF/CRLF conversion warnings.

## Independent review

### Tester / Failure Analyst

Initial blockers identified that the UI regenerated retry keys, replay was policy-gated as a new
mutation, relationship conflict mappings lacked direct evidence, and barriers were unbounded.
Corrections retained a logical-attempt key and payload, resolved sender-scoped/fingerprint-checked
replays before new-send policy, added unit/HTTP evidence, and bounded/cleared barrier timers.
Re-review reported no unresolved blockers.

### Architecture / Security

Initial blockers identified a request-vs-block race and a request-ID existence oracle. Corrections
moved request creation/reactivation into the relationship Serializable protocol, added deterministic
PostgreSQL evidence, kept notifications post-commit, and restored identical `403` responses for
missing and wrong-recipient IDs. Re-review confirmed Issue #32 history/block semantics, module
boundaries, and migration safety, with no unresolved blockers.

## Deferred correctness debt

- Milestone 2 needs a transactional outbox and worker for durable eventual notification, Socket.io,
  Gemini, Steam, and media-finalization effects, including retry and dead-letter policy.
- Steam replace-style synchronization needs a short post-provider transaction and explicit stale
  snapshot semantics.
- Community invite/join state transitions and their targeted notification dedupe remain focused
  follow-up work; no broad community rewrite was included.
- R2 orphan cleanup and media compensation remain future worker responsibilities.
- Process-local Socket.io delivery remains best effort; this change does not claim exactly-once
  mutation or delivery semantics.
