# Global Claude Code config (already applied on this machine)

These were added to the user's **global** config during the session that
produced this repo. Documented here so the context is portable — do not
re-apply blindly on another machine without the helper scripts in place.

## 1. SessionStart auto-reaper hook

Added to `~/.claude/settings.json` under `hooks` — runs at the start of every
session and kills dev servers whose worktree no longer exists:

```json
"SessionStart": [
  {
    "hooks": [
      { "type": "command", "command": "/Users/zee/.local/bin/reap-dev-servers orphans" }
    ]
  }
]
```

Hooks run **unsandboxed**, so the reaper's `kill` actually lands here (unlike
the Claude Bash tool, which drops signals — see HANDOFF §3).

## 2. CLAUDE.md protocol

Appended to `~/.claude/CLAUDE.md` so every parallel agent shares one convention:

```md
## Parallel Sessions & Dev Servers
I run many sessions in parallel — the desktop app gives each its own git worktree (`.claude/worktrees/<name>/`), and I work across different projects at once. To keep ports sane and avoid stale servers:
- **Look before binding.** Run `ports` (lists PORT · PID · UPTIME · PROJECT) before starting a dev server. Don't start a second one for a project that already shows a server unless it's intentionally parallel.
- **Don't fight over ports.** Never hardcode a port for a worktree/parallel run. Prefer Portless for a stable name: `portless <project> bun run dev` → `https://<project>.localhost` (use `<project>-<branch>` for parallel worktrees of the same repo). Otherwise let the framework auto-pick a free port (Next increments automatically).
- **No stale servers.** Worktree dev servers are auto-reaped at session start once their worktree is gone (`reap-dev-servers` SessionStart hook). Stop any server you start when done. Force a sweep with `reap-dev-servers orphans`.
- `ports` is the source of truth for what's bound; `reap-dev-servers` is for cleanup. Both live in `~/.local/bin`.
```

## 3. Live helper scripts

The three scripts in `reference/` are copies. The **live** versions are on PATH at:
- `~/.local/bin/ports`
- `~/.local/bin/reap-dev-servers`
- `~/.local/bin/fleet`

The OpenTUI build can keep these as-is (the new app installs alongside as a
richer `fleet`), or supersede `fleet` once it reaches parity.
