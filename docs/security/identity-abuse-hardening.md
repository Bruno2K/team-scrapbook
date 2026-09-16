# Security, identity, and abuse hardening

**Owning issue:** [GitHub Issue #32](https://github.com/Bruno2K/team-scrapbook/issues/32)

This document records the trust boundaries, concrete defects, policy decisions, and operational
limits established by Issue #32. It describes application enforcement, not a claim that the service
has distributed abuse prevention or a complete security platform.

## Trust boundaries

- **Unauthenticated HTTP callers** may use public profile, public feed, public-community, health, and
  authentication endpoints. They cannot read scraps, private-community content, notifications,
  conversations, or account-owned state.
- **Authenticated users** are represented inside the backend by a minimal actor containing only the
  current user ID and `isAiManaged` flag. A signed token alone is insufficient: the user must still
  exist, and AI-managed users cannot establish interactive user sessions.
- **Relationship and block state** is authoritative server-side. A block in either direction denies
  new friendship acceptance, scraps, chat creation/messages, typing, notifications from the denied
  action, and content interaction between the pair. Existing conversation and scrap history remains
  readable to its original participants.
- **Community state** is authoritative server-side. Private posts, comments, reactions, and member
  lists require current membership. Owners alone delete communities and grant `ADMIN`; administrators
  retain ordinary management, invite, and review powers, and moderators retain moderation powers.
- **Socket.io clients** authenticate with `handshake.auth.token`, resolve the current actor before
  joining only `user:<actorId>`, and reuse messaging policy and payload validation used by HTTP.
  Query-string session tokens and caller-selected protected rooms are not accepted.
- **AI-managed actors** are internal principals, not alternate user sessions. AI content operations
  call the same block, content visibility, membership, and messaging policy surfaces as human actors.
  The public AI batch endpoint cannot make mutations under arbitrary AI identities.
- **Steam** crosses an external identity boundary. The browser requests a provider URL with its
  bearer token, then the callback carries only a short-lived, HS256, `steam-link` purpose token.
  A general access token is not placed in a URL.
- **Gemini and storage providers** are untrusted external integrations. Provider failures on touched
  security paths are translated into stable public errors rather than returning internal messages.
- **Runtime configuration** crosses the deployment boundary. Production startup rejects a missing,
  placeholder, or shorter-than-32-character `JWT_SECRET`.

## Concrete risks corrected

- A known development JWT secret was silently usable in production; algorithms and claims were not
  explicitly validated, and Socket.io did not confirm that the token user still existed.
- Public profile feed/media and guessed `/feed/:id` requests disclosed participant-only scraps and
  scrap comments.
- Private-community posts were reachable through generic feed, direct-post, comment, and reaction
  paths without membership checks.
- Scraps, pending friend-request acceptance, and Socket.io typing bypassed bidirectional block policy.
- Socket message payload validation was weaker than HTTP validation.
- Any authenticated user could trigger writes under arbitrary AI-managed identities.
- Community administration returned ambiguous empty results for forbidden queues, and non-owner
  administrators could grant `ADMIN` or delete a community.
- Mutation schemas silently accepted extra ownership/system fields on representative endpoints.

## Authentication contract

- Ordinary HTTP accepts `Authorization: Bearer <access-token>` only.
- Socket.io accepts the access token only through `handshake.auth.token`.
- Steam callbacks accept only a short-lived token with purpose `steam-link`.
- Access verification pins HS256, verifies expiration and a non-empty consistent subject/user ID,
  accepts pre-hardening `{ userId }` tokens for rollout compatibility, and resolves a current user.
- Authentication responses are stable and do not expose token contents, secrets, database errors, or
  provider internals.

## Process-local abuse controls

Login/register attempts, social mutations, chat messages (HTTP and Socket.io), and the AI trigger are
guarded by bounded in-memory counters. These controls are deliberately **process-local**:

- counters are not shared between service replicas;
- a process restart clears all counters;
- source IP accuracy depends on trusted proxy configuration;
- they reduce accidental and low-volume abuse but are not distributed enforcement.

Redis, a WAF, CAPTCHA, distributed Socket.io, and a distributed rate limiter remain explicitly out of
scope for Issue #32.

## Remaining debt

- Browser access tokens remain in `localStorage`; migration to hardened browser session storage,
  OAuth/OIDC, MFA, and passkeys is deferred.
- Existing data disclosed before these checks cannot be recalled by an application-code change.
- Process-local presence and Socket.io delivery remain single-process and are not distributed.
- Comprehensive dependency remediation, CSP/security-header work, audit logging, observability,
  transaction/idempotency redesign, and Gemini provider migration remain separate work.
- Public profile projections still expose the existing coarse `online` flag, including to anonymous
  or blocked viewers; presence-privacy semantics require a separate product decision and are deferred.
- Socket typing events are authorization-checked but not rate-limited; message writes carry the
  proportional process-local limit introduced here.
