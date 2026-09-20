# Public HTTP API compatibility

**Owning issue:** [GitHub Issue #40](https://github.com/Bruno2K/team-scrapbook/issues/40)

This is the lightweight policy for evolving the public HTTP surface documented in `backend/src/openapi.ts`. It is not a separate API governance framework.

## Source of truth

- **Runtime** (`backend/src/app.ts` and mounted routers) is authoritative for implemented behavior.
- **OpenAPI** is the checked-in contract for public METHOD+PATH coverage and documented authentication semantics.
- Structural agreement is enforced by `npm run contract:check` in `backend`. That gate compares the composed Express application to OpenAPI after path-parameter normalization (`:id` ↔ `{id}`).

Swagger UI (`/api-docs` and its assets) and `GET /api-docs.json` are documentation surfaces. They are excluded from product-route drift; they are not a second product API.

## Evolution rules

1. **Prefer additive changes.** New routes, optional request fields, and additional response fields are the default compatibility path.
2. **Incompatible changes need an owning Issue.** Removing or renaming a public route, making a previously optional request field required, removing a response field clients rely on, or changing status/auth semantics requires an Issue, compatibility analysis, and coordinated OpenAPI, test, and affected client updates.
3. **Change the contract together.** A public HTTP change is incomplete if OpenAPI, the drift check, and the tests or frontend callers that depend on it are not updated in the same change.
4. **Do not bypass the drift gate.** Do not add a duplicate hand-maintained route inventory, skip `contract:check`, or widen exclusions to hide product routes. New exclusions need a documented rationale and must not match nothing.
5. **Deprecate explicitly when compatibility warrants it.** If an old METHOD+PATH must remain temporarily, keep it in runtime and OpenAPI, document that it is deprecated, and give an owning Issue for removal. Silent dual-write of incompatible shapes is not a substitute.

## Out of scope for this policy

Socket.io events, browser session storage, and generated clients are not covered here. HTTP contract work must not use this document to justify those redesigns.
