---
name: feature-development-with-tests-and-docs
description: Workflow command scaffold for feature-development-with-tests-and-docs in zadar.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-tests-and-docs

Use this workflow when working on **feature-development-with-tests-and-docs** in `zadar`.

## Goal

Implements a new feature, updates or creates relevant components, adds or updates tests, and documents the changes in README/FEATURES.

## Common Files

- `src/App.tsx`
- `src/components/*.ts*`
- `src/*.test.ts*`
- `README.md`
- `FEATURES.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Implement feature logic in relevant src/ files (e.g., components, main app logic).
- Update or create corresponding test files (e.g., .test.ts or .test.tsx).
- Update documentation files (README.md, FEATURES.md) to describe the new feature.
- Update or add helper or utility files as needed.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.