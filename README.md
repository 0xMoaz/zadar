# zadar

**Radar for your agent fleet.** While you've got 4+ Claude Code / Codex
agents running across git worktrees, zadar is the always-open split that
answers — in under a second of glance — **which agent needs you right now**,
and shows you *the exact question it's blocked on*:

```
▲ webapp · fix/auth   waiting · 8m
  "Should I overwrite the existing config at app/config.ts?"
```

…plus who's working, who's near their context limit, what it's costing, and
what's eating your machine — and lets you act (kill stale servers, prune
worktrees) without leaving the terminal.

It's the ambient, terminal-native complement to a desktop console like Readout:
same data universe, opposite ergonomics — zadar lives in your peripheral vision
while you work, the way a radar scope does.

**Status:** working OpenTUI app, three generations deep — all merged to
`main`, each tagged so you can `git checkout` any era. `v1`: the port. `v2`:
truthful states + progressive disclosure + living signal. `v3` (current): the
attention map + sessions-first home + **full Codex transcript parsing**
(context %, cost, task lifecycle, and plan-quota burn read straight from
`~/.codex/sessions`) + a local data API. Built on OpenTUI 0.3.x (Bun +
React); the bash scripts in [reference/](./reference/) remain the original
data contract.

## Install & run

```bash
# macOS standalone binary — no Bun, no Node, no deps (curl installer)
curl -fsSL https://raw.githubusercontent.com/0xMoaz/zadar/main/install.sh | bash

# or, with Bun installed:
bunx zadar                     # zero-install try
bun add -g zadar               # keep it
```

First run installs the bundled **Zadar Mark** font (the header logo) into your
user fonts — restart your terminal once and the wordmark wears it. No terminal
configuration needed: the mark sits at a private-use codepoint (U+E100) that
system font fallback resolves on its own. Without the font, the header is the
plain wordmark.

Updating: zadar checks the registry ambiently (once a day, never blocking)
and shows a faint `↑version` in the header when you're behind — then
`zadar upgrade` updates in place, using whichever way you installed.

Releases are built by CI on git tags: each platform compiles a standalone
binary with the Bun runtime embedded (`bun build --compile`). macOS arm64 +
x64 today; Linux is gated on collector portability (agent discovery,
clipboard, and notifications are macOS-specific right now), not on the
pipeline. Or clone for local dev:

```bash
bun install
bun run fleet                 # live dashboard (inside the repo only)
bun run smoke                 # headless render at several geometries
bun test                      # unit + headless interaction suite
git checkout v1               # any era is one checkout away (v1 · v2 · v3)
```

For a global `zadar` command from a clone (without installing):

```bash
printf '#!/bin/sh\nexec bun %s/src/index.tsx "$@"\n' "$(pwd)" > ~/.local/bin/zadar
chmod +x ~/.local/bin/zadar
```

> **PATH trap:** outside this repo, `bun run fleet` falls through to whatever
> `fleet` binary is on your PATH — on this machine that's the *old bash
> dashboard*, which prints one frame and exits. Use `zadar` (above) instead.

**One view, urgency first.** **Needs you** leads — every actionable item
ranked (questions, pending tools, errors, reviews, sick servers) — with
**Sessions** open beneath (status-sorted, urgent rows auto-expand their
literal question), and **Servers** and **Projects** (repos: cost, server,
worktrees + guarded pruning) folded after. `⏎` or a click on a queue item
takes you to the session's app; on a server it opens the browser.

**Keys:** `↑↓`/`jk` move · `⏎`/click go / fold / details · `␣` inspect ·
`←→`/`hl` fold · `o` open (session's app / browser) · `c` copy (resume /
url) · `x` kill · `p` prune a clean worktree · `t` activity log · `n`
notifications · `i` idle · `r` refresh · `?` help · `q` quit.

**Local data API:** `zadar --api [port]` additionally serves the same truth
as JSON on `127.0.0.1:7433` — `GET /snapshot` (the full fleet state) and
`GET /events` (today's status flips). A richer surface (web, Readout, a
menubar widget) can mount zadar's data without it losing its terminal
identity.

**States:** `▲` waiting on you (literal question, or a tool pending >2m) ·
`✕` error · `◆` ready — turn finished, output awaiting your review (badged
with its diff `+214 −38`) · `●` working (brightens when the transcript is
actually moving) · `?` unknown · `○` idle (fades with age). The `zadar`
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
- **Repo:** `zadar` · **CLI binary:** `zadar` (born as `zefleet`, renamed pre-launch)
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
