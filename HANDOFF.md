# Fleet — OpenTUI Dashboard · Handoff Spec

> Goal: rebuild the working bash dashboard `~/.local/bin/fleet` as a proper
> **OpenTUI** (TypeScript/Bun) terminal app with interactivity (select & act on
> servers/worktrees), keeping the bash version as the data-semantics reference.
>
> This file is the cold-start context for a fresh session to plan and run
> parallel agents. Repo: **zefleet**. CLI binary stays **fleet**. Start at
> [README.md](./README.md).

---

## 1. What already exists (built this session)

All in `~/.local/bin` (on PATH, bash 3.2-safe, macOS):

| File | Purpose |
|------|---------|
| `ports` | Lists dev-server listeners: `PORT PID UPTIME PROJECT`. Filters to node/bun/deno/vite/next-server*. |
| `reap-dev-servers` | Kills **stale** dev servers tied to git worktrees. `orphans` (default) kills only servers whose `.claude/worktrees/<x>` dir is gone; `end` reads hook JSON on stdin and kills servers under the ending session's worktree. |
| `fleet` | **The reference implementation.** Bash dashboard, 5 sections + `-w` live mode. The OpenTUI app must reach data parity with this, then add interactivity. |

Global config (already applied, authorized by user):
- `~/.claude/settings.json` → `SessionStart` hook runs `reap-dev-servers orphans`.
- `~/.claude/CLAUDE.md` → "## Parallel Sessions & Dev Servers" protocol (ports/Portless/cleanup rules every agent follows).
- zee.gg `memory/MEMORY.md` → note that Zee now works parallel across worktrees/projects.

Context: user runs **many parallel desktop sessions** (each = its own git worktree under `.claude/worktrees/`) across multiple repos. Portless (`portless <name> <cmd>` → `https://<name>.localhost`, installed globally) is the preferred way to avoid port collisions. Original trigger: two Next dev servers had ballooned to 14GB+10GB; this tooling gives visibility + auto-cleanup.

---

## 2. Data sources (the reusable crown jewels)

The OpenTUI app needs the SAME data. Easiest path: shell out via Bun (`Bun.$`) and parse, mirroring these exact commands. (Reimplementing natively is possible but unnecessary.)

**System (memory/swap/load):**
```
sysctl -n hw.memsize      # total bytes
sysctl -n hw.pagesize     # page size
sysctl -n vm.swapusage    # "total = X  used = Y  free = Z" → used = field $6
sysctl -n vm.loadavg      # "{ a b c }" → fields $2 $3 $4
vm_stat                   # used ≈ (Pages active + wired down + occupied by compressor) * pagesize
```
Avoid `memory_pressure` in a refresh loop — it's slow (~1-2s). Compute used% from `vm_stat`.

**Dev servers:**
```
lsof -nP -iTCP -sTCP:LISTEN        # NAME col ($9) like *:3000 → port = last :-field; pid = $2
# keep only comm in {node,bun,deno,vite,next-server*}:  ps -p PID -o comm=
ps -p PID -o rss= -o etime=        # mem (KB), uptime
lsof -a -p PID -d cwd -Fn | sed -n 's/^n//p' | head -1   # project cwd
```

**Claude sessions (parallel agents):**
```
ps -axo pid=,etime=,rss=,command= \
  | grep 'claude.app/Contents/MacOS/claude' | grep 'stream-json' | grep -v 'Helpers/disclaimer'
# model: parse '--model <x>' from command;  project: lsof cwd of pid
```

**Top memory (whole-system hog catcher):**
```
ps -axo rss,pid,comm | sort -rn | head -5     # rss KB; comm basename for label
```

**Worktrees (per repo, collapsed):**
```
for repo in ~/Code/*/ ; do  wts="$repo.claude/worktrees"; [ -d "$wts" ] || continue
  for wt in "$wts"/*/ ; do
    git -C "$wt" rev-parse --abbrev-ref HEAD     # branch
    git -C "$wt" status --porcelain | grep -c .  # dirty count
  done
done
# Render: per repo a summary line (N worktrees · X changed · Y clean), expand only the changed ones.
```
Observed live: `argo` had 7 clean agent-* worktrees (stale clutter, prunable via `git worktree remove`); `omnipair-webapp` had 9 (5 changed).

---

## 3. Gotchas / lessons (do not relearn the hard way)

- **`pgrep -f` is unreliable under the Claude Code Bash sandbox** (can't read other procs' arg vectors) → use `ps -axo … | grep`. In the user's real terminal pgrep works, but ps is portable. The OpenTUI app runs in the user's terminal (fine), but agents *testing* it via the Bash tool will hit the sandbox — prefer ps-based collectors.
- **`kill` signals are dropped by the Bash sandbox** for processes it didn't spawn. The SessionStart hook runs unsandboxed so cleanup works in practice; agents testing kill actions need `dangerouslyDisableSandbox`.
- **Process duplication:** each desktop session shows a tiny `Helpers/disclaimer` launcher + the real `claude` proc — filter the disclaimer out.
- bash alignment pain (pad-before-ANSI) **goes away** in OpenTUI — Yoga flexbox handles layout. Big reason to port.
- Worktree scan cost: ~2 git calls × N worktrees per refresh; fine at 2s for <30 worktrees, but consider caching/longer interval if it grows.

---

## 4. OpenTUI facts (grounded — verify versions at build time)

- **Bun-exclusive** (Node/Deno WIP). May require **Zig** installed to build native packages — verify during scaffold; npm packages may ship prebuilt binaries.
- Scaffold: `bun create tui` (create-tui). Packages: `@opentui/core`, `@opentui/react` (also `@opentui/solid`).
- Primitives: **Text, Box, Input, Select, ScrollBox, Code**. **Yoga** CSS-like flexbox. Built-in keyboard handling, focus management, tree-sitter syntax highlighting.
- React entry:
  ```tsx
  import { createCliRenderer } from "@opentui/core"
  import { createRoot } from "@opentui/react"
  function App() { return <box>...</box> }
  const renderer = await createCliRenderer()
  createRoot(renderer).render(<App />)
  ```
- Docs: https://opentui.com/docs/getting-started · Repo: github.com/sst/opentui

---

## 5. Proposed architecture (starting point for the planner)

```
fleet/
  src/
    collectors/        # pure data layer — one async fn per section, returns typed data
      system.ts        #   shells out (Bun.$), parses, returns {usedGB,totalGB,pct,swap,load}
      servers.ts       #   DevServer[] {port,pid,memKB,uptime,project}
      sessions.ts      #   Session[]   {pid,memKB,uptime,model,project}
      topmem.ts        #   Proc[]      {memKB,pid,name}
      worktrees.ts     #   RepoWorktrees[] {repo,total,changed,items:[{name,branch,dirty}]}
    components/        # one panel per section (Box + Text), flex layout
      SystemPanel.tsx  ServersPanel.tsx  SessionsPanel.tsx  TopMemPanel.tsx  WorktreesPanel.tsx
    actions.ts         # kill server, git worktree remove (guarded confirm)
    App.tsx            # layout + 2s poll + keybindings
    index.ts           # renderer bootstrap
```
**Value-add over bash (the point of porting):** interactivity — arrow/`j`/`k` to select a dev server or worktree, `x` to kill server / prune worktree (with confirm), `r` refresh, `q` quit, number keys to jump panels. Use `Select`/`ScrollBox` + focus management.

---

## 6. Parallelizable work breakdown (for parallel agents)

Each agent gets this file + the bash `fleet` as the contract. Collectors are independent → ideal fan-out.

- **A — Scaffold:** `bun create tui` (React), tsconfig, lint, `bin` entry, shared `types.ts`. Confirm Zig/native build works on macOS.
- **B — Collectors I:** `system.ts`, `servers.ts` (+ unit-style sanity checks vs `ports` output).
- **C — Collectors II:** `sessions.ts`, `topmem.ts`, `worktrees.ts`.
- **D — UI panels:** all 5 panels + `App.tsx` layout (flexbox, headers, colors, empty "none" states). Consumes types from A.
- **E — Interactivity:** keybindings, selection, `actions.ts` (kill/prune with confirm + sandbox-aware execution).
- **Integrator:** wire polling + state, parity pass against bash `fleet`, README + run instructions.

**Acceptance:** data parity with all 5 bash sections; graceful empty states; `bun run fleet` launches; selecting + killing a dev server works; no crash when a repo/worktree is missing; refresh stays smooth (no flicker, no >1s stalls).

---

## 7. Reference: current bash `fleet` output shape
```
 FLEET   Sat 23:25
 SYSTEM        ram 37G used / 64G (58%)   swap 5499M   load 4.7 4.9 4.8
 DEV SERVERS   PORT PID MEM UPTIME PROJECT          (or "none")
 CLAUDE SESSIONS  PID MEM UPTIME MODEL PROJECT
 TOP MEMORY    MEM PID NAME  (top 5 by RSS)
 WORKTREES     <repo> N worktrees · X changed · Y clean   + indented changed ones
```
Colors: mem >4G red, >1.5G yellow; mem%/swap thresholds green→yellow→red. `-w` = redraw every 2s (capture→clear→print to avoid flicker).
