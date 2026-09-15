# Context Pack: <task title>

Keep this pack compact. Point to authoritative context instead of copying it; remove prompts that do not help execute the task.

## Owning issue

<Actual GitHub Issue link>

## Exact objective

<One concise execution objective.>

## Known facts

- <Established fact the executor must not rediscover, with source link.>

## Read first

1. <Smallest required file, path, or section.>

## Read only if needed

- <Secondary source and the condition that makes it necessary.>

## Probably irrelevant

- <Area to avoid unless evidence changes scope.>

## Contracts / invariants affected

- <Only task-relevant contracts, or `None`.>

## Current known risks

- <Task-specific risk or uncertainty.>

## Required verification

- `<command>` — <what it proves>.
- <Manual or review check that cannot be expressed as a command.>

## Expected artifacts / evidence

- <Required file, diff, test output, screenshot, or PR evidence.>

## Stop conditions

- <Acceptance boundary where execution ends.>

## Escalation triggers

Stop broad implementation and surface a blocker if a destructive migration is unexpectedly required, authentication semantics need redesign, a production secret is required, issue assumptions are materially contradicted, or safe completion requires scope expansion. Add task-specific triggers when needed.
