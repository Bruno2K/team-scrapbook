# Agent governance and review workflow

This document extends the repository workflow in [`AGENTS.md`](../../AGENTS.md). It defines logical responsibilities and risk-based gates, not a requirement for permanent bots or multiple agents on every task.

## Choose the path

A change is **trivial** only when it is small, reversible, explicitly scoped by its owning Issue, and does not alter a runtime contract, security boundary, production behavior, or meaningful product behavior. It may use `Issue → Implement → Focused verification → PR`, and the implementer may perform the review.

A change is **material** when an error could affect users, data, integrations, deployment, security, or a shared contract, or when the solution requires non-obvious design judgment. Authentication or authorization, database contracts or migrations, shared API or event contracts, realtime semantics, production infrastructure, security boundaries, and AI behavior with meaningful product or safety implications are always material. Do not silently classify these changes as trivial.

Material changes follow:

`Issue → Context/Spec as needed → Plan → Implement → Verify → Independent Review → PR → Evidence`

Use a Context Pack, Spec, or ADR only under the criteria in `AGENTS.md`; governance does not create a parallel planning system. The plan must identify scope, affected contracts or invariants, verification, review lenses, and any expected human gate.

## Responsibilities

One person or agent may hold multiple responsibilities except where independent review is required.

- **Implementer:** confirms the owning Issue and acceptance criteria; stays within scope; identifies affected contracts, risks, and human gates before acting; makes the smallest coherent change; runs proportional verification; and reports known failures and remaining risk.
- **Tester / Failure Analyst:** checks acceptance criteria, relevant tests, boundary cases, expected failure modes, and the meaning of failures. It distinguishes regressions from known baseline failures and challenges unsupported claims of correctness.
- **Architecture / Security Reviewer:** when warranted, checks trust and authorization boundaries, data handling, compatibility of shared contracts, migration and rollback implications, production blast radius, and whether the design introduces avoidable coupling or bypasses established controls.

Review records contain conclusions and resulting changes, not private chain-of-thought.

## Independent review

Independent review means a human or AI reviewer that did not produce the change evaluates the final diff and evidence. It is required before the PR for:

- every material change in the always-material areas listed above;
- changes spanning multiple runtime or contract boundaries;
- irreversible or difficult-to-rollback behavior;
- changes whose verification is incomplete, ambiguous, or depends on assumptions not established by the owning Issue.

Use the Tester / Failure Analyst lens for all independently reviewed changes. Add the Architecture / Security lens when security, trust, data, contracts, migrations, infrastructure, realtime behavior, or consequential AI behavior is involved. Resolve in-scope findings before the PR. A finding that undermines acceptance criteria, required verification or review, a safety boundary, or human-gate compliance is a blocker; only non-blocking residual risk or out-of-scope observations may remain in an open PR. The implementer cannot waive required independent review because tests or CI are green.

Trivial changes do not require an independent reviewer unless new evidence increases their risk.

## Human gates

A human gate requires explicit approval for the specific proposed action. The agent must stop before acting, state the intended action, reason, blast radius, rollback or recovery path, evidence available, and safer alternatives. Approval is not implied by prior conversation, repository history, issue wording, successful tests, or CI status.

Explicit human approval is mandatory before:

- destructive or irreversible database operations, destructive migrations, or risky data backfills;
- creating, rotating, or changing production secrets or credentials through an approved secret-management mechanism;
- changing authentication or authorization semantics;
- production infrastructure changes with significant blast radius;
- security-sensitive actions when impact or rollback is unclear;
- any irreversible or high-blast-radius action affecting users, data, security boundaries, production behavior, or consequential AI safety behavior, including weakening a security control;
- rewriting history or force-pushing a shared branch.

Issue scope authorizes investigation and preparation, not execution past a human gate. After approval, record the decision and constraints in the PR or other appropriate evidence artifact. If approval is denied, absent, or narrower than the proposed action, do not proceed.

## Safety boundaries

The safety rules in `AGENTS.md` remain authoritative. In addition, agents must not:

- expose or persist secret or credential values in code, logs, prompts, PRs, or evidence;
- bypass required review or branch protections; any administrative exception is human-owned and outside agent execution;
- silently weaken, skip, delete, or rewrite tests or security controls to obtain a green result;
- hide known failures or misrepresent partial verification as success;
- change unrelated code, configuration, dependencies, or infrastructure to make verification pass;
- rewrite history or force-push shared branches without explicit scope and human approval.

When safe completion needs a forbidden action or scope expansion, stop and surface the blocker. Do not perform a high-blast-radius action merely to produce evidence.

## Failure, retry, and escalation

Use this loop for recoverable failures:

`fail → inspect new evidence → adjust the approach → retry`

Every retry must be justified by new evidence or a materially changed approach. An initial failure may be followed by one adjusted retry when the evidence supports it. If that retry fails toward the same objective, reassessment is mandatory; another attempt is allowed only when decisive new evidence explains why the expected outcome has changed. Do not repeat a materially identical failed action, consume unbounded context chasing a green result, or use retries to conceal architectural uncertainty.

After the failed adjusted retry, or whenever another retry has no new evidence behind it, use:

`stop → reassess → surface the blocker or scope conflict`

Retry transient tooling or environment failures only after checking their cause and state. Stop and escalate when Issue assumptions are contradicted, the affected contract cannot be established, correctness remains ambiguous, a human gate is reached, or safe completion requires expanded scope. Record the useful failure conclusion and its effect on verification; do not dump exploratory logs or private reasoning.

## Correctness and evidence

**Green CI is necessary evidence, not sufficient proof of correctness.**

For a material change, assess correctness against:

- the owning Issue and its acceptance criteria;
- affected contracts and invariants;
- relevant tests and focused checks;
- expected and observed failure modes;
- runtime or deployment evidence when applicable;
- independent-review conclusions;
- remaining risk and verification gaps.

The PR or repository evidence must persist only information useful to future engineering work:

- decisions and concise rationale that shaped the implementation;
- verification performed and relevant results, including known or baseline failures;
- independent-review lenses, findings, and resulting adjustments;
- explicit human approval and its constraints when materially relevant;
- unresolved risks, limitations, blockers, and out-of-scope follow-up.

Never persist private chain-of-thought. Persist conclusions, evidence, and rationale sufficient for another reviewer to evaluate the change.
