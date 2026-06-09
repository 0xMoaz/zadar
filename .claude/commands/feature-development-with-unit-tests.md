---
name: feature-development-with-unit-tests
description: Workflow command scaffold for feature-development-with-unit-tests in zefleet.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-unit-tests

Use this workflow when working on **feature-development-with-unit-tests** in `zefleet`.

## Goal

Implements a new feature or significant logic change, accompanied by comprehensive unit tests for the new or changed logic.

## Common Files

- `src/*.ts`
- `src/*.test.ts`
- `src/types.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Implement or overhaul logic in one or more source files (e.g., src/transcript/status.ts, src/signal.ts, src/collect.ts)
- Update or create corresponding unit test files (e.g., src/transcript/status.test.ts, src/signal.test.ts, src/collect.test.ts)
- Update types as needed (src/types.ts)
- Update related UI components if applicable

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.