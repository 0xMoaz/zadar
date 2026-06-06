# zeefleet

A terminal dashboard for parallel dev work — see every dev server, Claude
session, memory hog, and git worktree across all projects at a glance, and act
on them (kill stale servers, prune worktrees) without leaving the terminal.

**Status:** spec'd, not built. A working **bash prototype** exists and serves as
the data contract; the goal is a polished **OpenTUI** (TypeScript/Bun) rewrite
with interactivity.

## Pick up here (for a fresh session)

1. Read **[HANDOFF.md](./HANDOFF.md)** — full spec: data sources, gotchas,
   OpenTUI facts, proposed architecture, and a parallelizable task breakdown.
2. Skim **[reference/](./reference/)** — the bash prototype. `fleet` is the
   reference implementation; `ports` and `reap-dev-servers` are its building
   blocks. These define the exact data semantics the OpenTUI app must match.
3. Read **[reference/global-config.md](./reference/global-config.md)** — the
   global Claude Code hook + CLAUDE.md protocol already wired up on this machine.

## Goal

Port `reference/fleet` (bash) → OpenTUI app:
- **Repo:** `zeefleet` · **CLI binary:** `fleet`
- **Stack:** Bun + `@opentui/core` + `@opentui/react`, Yoga flexbox layout
- **Parity first** (5 sections: system · dev servers · Claude sessions · top
  memory · worktrees), **then** add interactivity (select a server/worktree,
  kill/prune with confirm, keyboard nav).

## Why

Origin: two Next.js dev servers silently grew to 14GB + 10GB. The bash tools
gave visibility and auto-cleanup; this is the upgraded, interactive version.
The user runs many parallel desktop sessions (one git worktree each) across
multiple repos — collisions and stale servers are the problem being solved.

## Build (once scaffolded)

```bash
bun install
bun run fleet        # or the bin entry
```
> OpenTUI is Bun-exclusive and may require Zig to build its native core —
> verify during scaffold (see HANDOFF §4).
