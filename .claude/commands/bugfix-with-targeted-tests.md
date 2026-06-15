---
name: bugfix-with-targeted-tests
description: Workflow command scaffold for bugfix-with-targeted-tests in zadar.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /bugfix-with-targeted-tests

Use this workflow when working on **bugfix-with-targeted-tests** in `zadar`.

## Goal

Fixes a bug or corrects logic, with corresponding updates to test files to ensure accuracy.

## Common Files

- `src/*.ts`
- `src/*.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify and fix the bug in the relevant source file(s).
- Update or add test cases in the corresponding .test.ts or .test.tsx files to cover the fix.
- Refactor or add helper functions as needed.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.