# Repository instructions

Use this file as the operational entry point for repository work. Read the owning GitHub Issue first, then load only the context needed for that issue.

## Repository orientation

- Frontend: [`src/`](src/) and root [`package.json`](package.json).
- Backend HTTP and application behavior: [`backend/src/`](backend/src/) and [`backend/package.json`](backend/package.json).
- Database contract and migrations: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) and [`backend/prisma/migrations/`](backend/prisma/migrations/).
- Realtime entry points: [`backend/src/index.ts`](backend/src/index.ts) and [`backend/src/socket.ts`](backend/src/socket.ts).
- External integrations: locate the relevant backend service or frontend API client with targeted search; start with the [architecture baseline](docs/architecture/repository-baseline.md).
- Current architecture: [`docs/architecture/repository-baseline.md`](docs/architecture/repository-baseline.md).
- Local/deployment commands and verified behavior: [`docs/operations/repository-baseline.md`](docs/operations/repository-baseline.md).
- Known defects, gaps, and risks: [`docs/technical-debt/repository-baseline.md`](docs/technical-debt/repository-baseline.md).
- Backend module ownership and dependency rules: [`docs/architecture/modular-monolith.md`](docs/architecture/modular-monolith.md). Cross-module imports must use `backend/src/modules/<module>/index.ts`; run the architecture check when backend boundaries change.
- Observability, health/readiness, SLOs, and lifecycle: [`docs/operations/observability.md`](docs/operations/observability.md).
- Durable async processing: [`docs/architecture/transactional-outbox.md`](docs/architecture/transactional-outbox.md) and [`docs/operations/outbox-worker.md`](docs/operations/outbox-worker.md).

## Source-of-truth hierarchy

When sources conflict, use this order:

1. Runtime behavior in `src/` and `backend/src/`.
2. Prisma schema and migrations for the database contract.
3. `backend/src/openapi.ts`, checked against routes/controllers, for documented API contracts.
4. Package manifests and checked-in deployment configuration for commands and deployment behavior.
5. The architecture, operations, and technical-debt baselines for their recorded snapshot and evidence.
6. GitHub Issues, Specs, and ADRs for intended work and durable decisions.
7. README prose for onboarding only.

If intended behavior conflicts with current implementation, surface the conflict in the owning issue or PR; do not silently choose one.

## Load context deliberately

1. Read the owning GitHub Issue.
2. Read the task's Context Pack under [`docs/context/`](docs/context/) when one exists; use the [template](docs/context/TEMPLATE.md) only when creating one.
3. Open the smallest relevant baseline section and the files named by the issue/context pack.
4. Prefer `rg` and targeted paths over directory-wide or whole-repository reading.
5. Do not re-prove facts already established in the baseline. Expand context only when evidence contradicts assumptions or a required contract cannot be verified.

## Scope and traceability

- Implement only the owning issue. Material implementation must reference an actual GitHub Issue.
- Follow the risk-based [agent governance and review workflow](docs/agents/governance.md) for material changes, independent review, human gates, retries, and evidence.
- Record unrelated findings as remaining risk or follow-up; do not fix them opportunistically.
- Avoid speculative refactors and stop when the acceptance criteria and required evidence are satisfied.
- Pull requests must use actual GitHub numbering, never roadmap-generated PR identifiers.
- Persist decisions, rationale, evidence, and remaining risk; never store chain-of-thought.

## Safety

- Never commit secrets or real credentials; use documented environment-variable names and examples.
- Do not run destructive database commands, including resets, against shared or production data.
- Treat schema and migration changes as contract changes: inspect existing migrations, use a disposable/local PostgreSQL database, and include forward/rollback implications.
- Do not change production infrastructure or configuration without explicit issue scope and a rollback plan.
- For authentication, authorization, secrets, or other security-sensitive behavior, preserve existing semantics unless the issue explicitly changes them; document threat and compatibility implications.

## Verification

Use the existing commands in the [operations baseline](docs/operations/repository-baseline.md) and validate in proportion to the change. Run focused checks first; changes to shared contracts or runtime paths require the relevant frontend, backend, database, realtime, and/or integration checks on every affected side. Do not hide known baseline failures—distinguish them from regressions and report exact evidence in the PR.

## Risk-based engineering flow

Trivial path: `Issue → Implement → Focused verification → PR`

Material path: `Issue → Context/Spec when needed → Plan → Implement → Verify → Independent Review → PR → Evidence`

- **Issue:** owns scope and acceptance criteria.
- **Spec:** use [`docs/specs/TEMPLATE.md`](docs/specs/TEMPLATE.md) when behavior, invariants, failure modes, or acceptance criteria need more precision than the issue provides.
- **ADR:** use [`docs/adr/TEMPLATE.md`](docs/adr/TEMPLATE.md) for a durable architectural decision with meaningful alternatives or rediscovery cost.
- **Context Pack:** use [`docs/context/TEMPLATE.md`](docs/context/TEMPLATE.md) when targeted reading instructions and known facts will materially reduce execution context. It points to sources; it does not replace them.
- **PR:** connects implementation to the issue and records verification evidence plus remaining risk.

Small, obvious changes can proceed from Issue directly to implementation. A Spec and Context Pack are independent: use either or both only when they reduce ambiguity or search cost.

The reduced path is only for trivial, low-risk changes. A change involving shared contracts, data, authentication or authorization, realtime semantics, production infrastructure, security boundaries, or consequential AI behavior is material and must use the governance workflow.

## Instruction versioning

Store prompts or repository instructions that materially change engineering behavior in version-controlled repository files. Git history is the version record; the PR must describe the behavior change and reference its owning Issue. Do not create a separate prompt registry, database, model-routing layer, or metadata system without a demonstrated requirement.
