# zefleet

**Terminal mission control for parallel agentic dev.** While you've got 4+
Claude Code / Codex agents running across git worktrees, fleet is the always-open
split that answers — in under a second of glance — **which agent needs you right
now**, and shows you *the exact question it's blocked on*:

```
▲ webapp · fix/auth   waiting · 8m
  "Should I overwrite the existing config at app/config.ts?"
```

…plus who's working, who's near their context limit, what it's costing, and
what's eating your machine — and lets you act (kill stale servers, prune
worktrees) without leaving the terminal.

It's the ambient, terminal-native complement to a desktop console like Readout:
same data universe, opposite ergonomics — fleet lives in your peripheral vision
while you work.

**Status:** working OpenTUI prototype. v1 ships one beautiful, reliable slice —
**live agent awareness** (Claude Code today; Codex shown but not yet transcript-
parsed) — and grows toward broad parity from there. Built on OpenTUI 0.3.x
(Bun + React); the bash scripts in [reference/](./reference/) remain the data
contract.

## Install & run

```bash
npx github:0xMoaz/zefleet      # one-off run  (needs Bun → https://bun.sh)
```

`bunx github:0xMoaz/zefleet` works too. Or clone for local dev:

```bash
bun install
bun run fleet                 # live dashboard
bun run smoke                 # headless render at wide + narrow widths
```

**Keys:** `↑↓`/`jk` move · `⏎` disclose details / fold a section · `←→`/`hl`
fold · `o` open (Claude app / browser) · `c` copy (resume / url) · `x` kill ·
`p` prune a clean worktree · `t` activity log · `n` notifications · `i` idle ·
`r` refresh · `?` help · `q` quit.

**States:** `▲` waiting on you (literal question, or a tool pending >2m) ·
`✕` error · `◆` ready — turn finished, output awaiting your review (badged
with its diff `+214 −38`) · `●` working (brightens when the transcript is
actually moving) · `?` unknown · `○` idle (fades with age). The `fleet`
wordmark tints to the worst case and counts every state; a desktop
notification fires the moment an agent starts needing you.

## Docs

- **[DESIGN.md](./DESIGN.md)** — the interface: design system, palette, the
  responsive layout, interaction model, mockups.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the data layer: how the four hero
  signals are derived for Claude + Codex, caching, module structure (grounded in
  the real files on this machine).
- **[HANDOFF.md](./HANDOFF.md)** — the original cold-start spec + bash data
  semantics + parallelizable task breakdown.

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
- **Repo:** `zefleet` · **CLI binary:** `fleet`
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
> OpenTUI is Bun-exclusive (Node/Deno WIP). **No Zig needed** — `@opentui/core`
> 0.3.x ships prebuilt native binaries (`core-darwin-arm64`) via npm; Zig is only
> for building OpenTUI itself from source. Pin an exact 0.3.x (pre-1.0, fast API
> churn). Requires React ≥ 19.2.
