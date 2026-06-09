---
name: ui-component-enhancement-with-mock-and-smoke
description: Workflow command scaffold for ui-component-enhancement-with-mock-and-smoke in zefleet.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /ui-component-enhancement-with-mock-and-smoke

Use this workflow when working on **ui-component-enhancement-with-mock-and-smoke** in `zefleet`.

## Goal

Enhances or adds UI components, updating mock data and smoke test files to cover new UI states and flows.

## Common Files

- `src/components/*.tsx`
- `src/mock.ts`
- `src/smoke.tsx`
- `src/format.ts`
- `src/format.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Modify or add UI component files (e.g., src/components/*.tsx)
- Update mock data to reflect new UI states (src/mock.ts)
- Update or add smoke test files (src/smoke.tsx)
- Optionally update format or helper files (src/format.ts, src/format.test.ts)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.