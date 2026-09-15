# Context Pack: Issue #22 engineering context harness

This completed example is evidence for Issue #22 and may be removed later if it no longer helps explain the template.

## Owning issue

[GitHub Issue #22 — Establish specs, ADRs and agent context engineering harness](https://github.com/Bruno2K/team-scrapbook/issues/22)

## Exact objective

Add the smallest repository-native instruction, Spec, ADR, and Context Pack system that reduces future rediscovery without changing application behavior.

## Known facts

- The as-is system, operations evidence, and debt are already recorded in the [architecture](../architecture/repository-baseline.md), [operations](../operations/repository-baseline.md), and [technical-debt](../technical-debt/repository-baseline.md) baselines from Issue #20 / PR #21; do not repeat that analysis.
- Current implementation and configuration outrank descriptive documentation when they conflict; the exact hierarchy is in the architecture baseline.
- This issue is documentation/process infrastructure only; existing lint, test, audit, CI, auth, scaling, and integration work remains out of scope.

## Read first

1. [Issue #22](https://github.com/Bruno2K/team-scrapbook/issues/22).
2. [`AGENTS.md`](../../AGENTS.md).
3. [Architecture baseline](../architecture/repository-baseline.md), especially “Responsibility map” and “Source of truth.”
4. [Operations baseline](../operations/repository-baseline.md), especially commands and known results.
5. [Technical-debt baseline](../technical-debt/repository-baseline.md) for out-of-scope known failures.

## Read only if needed

- Root and backend package manifests, only to confirm command pointers.
- `README.md`, only to check that entry-point guidance does not conflict with onboarding.
- Application files, only if a proposed repository instruction cannot be made accurate from the baseline.

## Probably irrelevant

- Frontend components, pages, styling, and assets.
- Backend controllers, services, routes, tests, and integration implementations.
- Prisma schema/migrations and deployment-provider configuration.
- Dependency updates, CI, auth, realtime scaling, Steam, Gemini, and media behavior.

## Contracts / invariants affected

- Documentation authority and context-loading rules must remain consistent with the baseline.
- New templates must be optional and proportional, not mandatory ceremony for trivial changes.
- Repository instructions that materially affect engineering behavior remain versioned through Markdown and Git.

## Current known risks

- Duplicating baseline facts would create competing sources of truth.
- Overlong templates would increase context and maintenance cost.
- Vague “read as needed” guidance would fail to reduce the search space.

## Required verification

- `git diff --check` — catches whitespace errors.
- Confirm every introduced relative link/path resolves.
- Compare `AGENTS.md` authority and commands with the baseline documents.
- Inspect the final diff and changed-file list for runtime changes, copied baseline content, and scope creep.
- Review Markdown headings and template usability manually; no runtime suite is required for a documentation-only diff.

## Expected artifacts / evidence

- Root `AGENTS.md`.
- Reusable Spec, ADR, and Context Pack templates.
- This completed Context Pack.
- PR verification notes confirming link checks, baseline references, and documentation-only scope.

## Stop conditions

- Stop after Issue #22 acceptance criteria are met, documentation review passes, and one PR to `main` is open.
- Do not begin agent governance, CI, security remediation, or product implementation.

## Escalation triggers

- A required instruction contradicts the baseline or live implementation materially.
- Accurate completion would require an application/runtime change, production access, a secret, destructive data work, or expansion into an excluded area.
