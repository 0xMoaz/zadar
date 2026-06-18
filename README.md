# zadar

**Radar for your agent fleet.**

Running several coding agents at once has one hidden cost: a blocked agent
is silent. A session waiting on your answer looks exactly like a session
making progress — until you go check every tab.

zadar is an always-open terminal view that checks for you. It watches every
Claude Code and Codex session on your machine and answers one question at a
glance: **who needs you right now, and what for.**

```
▲ webapp · fix/auth                                              waiting · 8m
    "Should I overwrite the existing config at app/config.ts?"
     1  Overwrite    2  Merge keys
```

The question an agent is stuck on floats to the top, options included — you
decide and move on. Errors, finished work waiting for review, and sick dev
servers queue up the same way, ranked by urgency.

Everything else stays quiet until it matters: who's actually working (the
spinner moves only while the transcript does — a stalled session freezes),
how close each session is to its context limit, what the fleet costs per
hour, which dev server is eating 14GB, which worktrees are safe to prune.

And setup is nothing. zadar reads the session files your agents already
write — no wrapper, no SDK, no hooks into your workflow. Quit it and
nothing changes; open it and you can see.

## Install

```bash
# macOS — standalone binary, no dependencies (adds itself to your PATH)
curl -fsSL https://raw.githubusercontent.com/0xMoaz/zadar/main/install.sh | bash
```

Or, with Bun installed:

```bash
bunx zadar              # disposable try — nothing lands on your PATH
bun add -g zadar        # keep it
npm install -g zadar    # npm works too (Bun still required to run)
```

Then open a new terminal and run:

```bash
zadar
```

`q` quits · `?` shows the keymap. zadar auto-updates on launch (the new version
applies next open); `zadar upgrade` forces it, `ZADAR_NO_AUTO_UPDATE=1` opts out.

## The view

- **Needs you** — everything blocked on you, ranked: questions with their
  answer options, tool approvals, errors, diffs awaiting review, sick servers.
  When it's empty, it says so and gets out of the way.
- **Sessions** — every live agent with truthful status, context %, and cost.
- **Servers · Projects** — bound ports with memory and staleness; repos with
  worktrees, dirty counts, and guarded pruning.

The full tour is in **[FEATURES.md](./FEATURES.md)**.

## One view, two shapes

The layout reflows to the pane you give it — automatically, no flags.

- **Full** (≥ 75 cols) — the desk dashboard: every section at once, each
  session's vitals on the right, fleet burn in the header.
- **HUD** (< 75 cols) — a compact *radar scope* for an always-on peripheral
  pane. One band fills the width; `Tab` cycles `Needs · Sessions · Servers ·
  Projects`. Each item is a single signal line — a colour-coded blip, what it
  needs, a clip of context — and `←`/`→` unfolds it in place. Pin it in a
  sticky column and glance over only when a blip changes.

## Keys

|  |  |
|---|---|
| `↑↓` / `jk` | move |
| `Tab` | switch band (HUD) |
| `⏎` / click | go to the session's app · open server · fold |
| `␣` | inspect a queue item |
| `c` / `x` | copy resume command or URL / kill (with confirm) |
| `p` | prune a clean worktree |
| `t` / `n` | activity log / desktop notifications |
| `?` / `q` | help / quit |

## Requirements

- **macOS** (arm64 or x64) — Linux is on the roadmap; the collectors are
  macOS-bound today.
- Something to watch: [Claude Code](https://claude.com/claude-code) and/or
  [OpenAI Codex](https://openai.com/codex). zadar reads their session files;
  it never wraps or modifies them.

## For builders

`zadar --api [port]` serves the fleet state as JSON on `127.0.0.1:7433`
(`GET /snapshot`, `GET /events`) — mount a web view, a menubar widget,
whatever you like.

Developing zadar itself:

```bash
git clone https://github.com/0xMoaz/zadar && cd zadar
bun install
bun run dev          # live dashboard
bun run demo         # mock fleet, no real agents needed
bun test             # unit + headless interaction suite
```

## License

[MIT](./LICENSE)
