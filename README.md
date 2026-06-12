# zadar

**Radar for your agent fleet.**

You're running four parallel Claude Code sessions and a Codex run across git
worktrees. Which one is blocked on you *right now*? zadar is the always-open
terminal split that answers in a glance — and shows the exact question:

```
▲ webapp · fix/auth                                              waiting · 8m
    "Should I overwrite the existing config at app/config.ts?"
     1  Overwrite    2  Merge keys
```

Beneath that: who's working, who's near their context limit, what it's
costing, which dev server is eating 14GB — and the keys to act on all of it
without leaving the terminal.

## Install

```bash
# macOS — standalone binary, no dependencies (adds itself to your PATH)
curl -fsSL https://raw.githubusercontent.com/0xMoaz/zadar/main/install.sh | bash
```

With Bun installed, there are package routes too:

```bash
bunx zadar              # disposable try — nothing lands on your PATH
bun add -g zadar        # keep it
npm install -g zadar    # npm works too (Bun still required to run)
```

Then open a new terminal and run:

```bash
zadar
```

`q` quits · `?` shows the keymap · `zadar upgrade` updates in place.

> First run installs the zadar mark (the header logo) as a tiny font —
> it appears after your next terminal restart. No configuration needed.

## What you see

One calm view, urgency first:

- **Needs you** — every item blocked on you, ranked: questions (with their
  answer options), pending tool approvals, errors, finished work awaiting
  review, sick dev servers.
- **Sessions** — every live Claude Code / Codex session with truthful status,
  context %, and cost, read straight from the agents' own transcript files.
  Nothing to configure.
- **Servers** and **Projects** — bound ports with memory and staleness; repos
  with their worktrees, dirty counts, and guarded pruning.

The full tour lives in **[FEATURES.md](./FEATURES.md)**.

## Keys

|  |  |
|---|---|
| `↑↓` / `jk` | move |
| `⏎` / click | go to the session's app · open server · fold |
| `␣` | inspect a queue item |
| `c` / `x` | copy resume command or URL / kill (with confirm) |
| `p` | prune a clean worktree |
| `t` / `n` | activity log / desktop notifications |
| `?` / `q` | help / quit |

## Requirements

- **macOS** (arm64 or x64) — Linux is on the roadmap; the collectors are
  macOS-bound today.
- Agents to watch: [Claude Code](https://claude.com/claude-code) and/or
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
