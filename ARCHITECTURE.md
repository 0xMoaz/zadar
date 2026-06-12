# zadar — Architecture & Data Layer

> How the four hero signals (status+wait · last-activity · context% · cost) are
> derived for Claude Code **and** Codex, plus the OpenTUI app structure. Every
> recipe here was verified against the real files on this machine. Companion to
> [DESIGN.md](./DESIGN.md) (the interface) and [README.md](./README.md).

## Data flow

```
collectors (pure, async, typed)  →  store (cached by mtime)  →  React state  →  render
   process/                          { file: (mtime, signals) }     1–2 Hz poll
   claude/  codex/  system/  servers/  worktrees/
```

Collectors are independent and side-effect-free (read-only). The store caches per
file by mtime so most ticks are a `stat()` + cache hit. Render is on-demand.

## 1. Process discovery → session file

**Find live agents** (matches the existing bash `fleet`):

```bash
ps -axo pid=,etime=,rss=,command= \
 | grep 'claude.app/Contents/MacOS/claude' | grep 'stream-json' | grep -v 'Helpers/disclaimer'
# Codex:  ... | grep -E 'codex' (filter to the real session proc)
```

Each Claude agent appears as a `Helpers/disclaimer` wrapper + the real
`claude` proc — keep the latter. The command line carries fields to regex:
`--model claude-opus-4-8[1m]` (note the `[1m]` 1M-context suffix lives **only**
here, not in the transcript), `--permission-mode`, `--resume <uuid>`, `--agent`.

**PID → cwd:**
```bash
lsof -a -p <pid> -d cwd -Fn | sed -n 's/^n//p' | head -1
```

**cwd → transcript:** replace `/`→`-`:
`/Users/zee/Code/zadar` → `~/.claude/projects/-Users-zee-Code-zadar/`.
Pick the `.jsonl` with newest mtime; if the proc has `--resume <uuid>`, use
`<uuid>.jsonl` directly (exact, robust). Cross-check: file's first-line
`sessionId` == filename stem.

> **Sandbox note:** under the Claude Code Bash *tool* sandbox, `ps`/`lsof`/`kill`
> on foreign procs are restricted (HANDOFF §3). The shipped app runs in the
> user's real terminal — fine. Agents *testing* collectors must use
> `dangerouslyDisableSandbox` or test against fixture files.

## 2. Claude transcript (JSONL, one event/line)

`type` ∈ `assistant · user · attachment · last-prompt · permission-mode ·
system · summary · file-history-snapshot · …`. The ones we use:

**`assistant`** — the signal carrier:
```jsonc
{ "type":"assistant", "timestamp":"…Z", "sessionId":…, "gitBranch":…, "requestId":…,
  "message": { "model":"claude-opus-4-8", "stop_reason":"tool_use|end_turn|null",
    "content":[ {"type":"thinking|text|tool_use|tool_result", …} ],
    "usage": { "input_tokens":20351, "cache_creation_input_tokens":33214,
               "cache_read_input_tokens":0, "output_tokens":413 } } }
```

**`last-prompt`** — `{"lastPrompt":"<user's last typed message>"}` (cheap "what
was asked").

### Status + wait-time (walk from the tail)

| Tail shape | Status | Preview |
|---|---|---|
| last assistant `content` ends in `tool_use` named **`AskUserQuestion`** | **▲ waiting on you** | the question text |
| last is assistant `tool_use`, `stop_reason:"tool_use"`, no following `user`/`tool_result` | ▲ waiting (tool approval)* | `Tool: <arg>` |
| tail recent (< ~60s), streaming text/thinking or tool_use→result | ● working | last activity |
| last assistant is plain `text`, `stop_reason:"end_turn"` | ○ idle (answered) | last text |
| no new events for > 5 min (by mtime) | ○ idle | last activity |

`wait-time = now − file mtime` (cheapest; mtime updates on every appended line).
*Tool-approval "waiting" is a heuristic — no explicit pending-permission marker.

### Last-activity preview (tail-scan, first match)

`AskUserQuestion` text → last assistant `text` (≈80 chars) → last `tool_use`
rendered `Tool(name): <key arg>` (`Bash: git diff`, `Read: foo.ts`) → fallback
`last-prompt.lastPrompt`.

### Context %

No window field in the file — **lookup by model**. Current occupancy = the **last
assistant** `usage`:
```
occupancy = input_tokens + cache_read_input_tokens + cache_creation_input_tokens   (exclude output)
context%  = occupancy / window
```
Windows: opus/sonnet/haiku 4.x = **200_000**; the `[1m]` variant (detect from
process `--model …[1m]`) = **1_000_000**. A sudden occupancy drop = auto-compaction
(correct to reflect).

## 3. Codex transcript (`~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`)

Codex stores **flat by date** (not by cwd), and — crucially — puts the window and
cumulative tokens **in the file**, so no lookup tables for context%.

- **`session_meta`** (line 1): `payload.{id, cwd, originator, cli_version, model_provider}` → cwd is in-file.
- **`turn_context`**: `payload.{cwd, model:"gpt-5.5", approval_policy, …}` → authoritative model.
  Written once at session start (and again on a model switch), **not** per turn — long
  sessions push it past the tail window, so fall back to the immutable head.
- **`token_count`** (the jackpot):
```jsonc
{ "info": {
    "total_token_usage": {"input_tokens":…, "cached_input_tokens":…, "output_tokens":…, "total_tokens":…},
    "last_token_usage":  {"total_tokens":138794, …},
    "model_context_window": 258400 },
  "rate_limits": { "primary": {"used_percent":45.0, …}, "secondary": {…}, "plan_type":"plus" } }
```
  - **context% = `last_token_usage.total_tokens / model_context_window`** (window in-file).
  - **cost/tokens = `total_token_usage`** (cumulative, ready-made — no summing).
  - bonus: `rate_limits.*.used_percent` = plan-quota burn (optional 5th signal).
- **cwd → session:** match `session_meta.cwd`, or read `~/.codex/session_index.jsonl`
  (id + thread_name + updated_at), newest `updated_at` per cwd.
- **Status:** tail-scan `event_msg.payload.type`: `task_started` / unmatched
  `function_call`|`exec_command` → working; `task_complete`|`turn_aborted` → idle.
  No structured "AskUserQuestion" → blocked-on-question is a text heuristic (flakier).
- **Preview:** last `agent_message.message` or last `function_call` as `name(arg)`.

> `~/.openclaw/` exists but is empty here — **not supported** until there's a real
> format to parse.

## 4. Cost (price-table multiply)

The machine already has tables/caches (reuse, don't reinvent):
- `~/.claude/readout-pricing.json` (per-1M USD): opus `{in 5, out 25, cacheRead .5, cacheWrite 6.25}`,
  sonnet-4-5 `{3,15,.3,3.75}`, haiku-4-5 `{1,5,.1,1.25}`.
  **Add an `opus-4-8` entry** (live model; same tier pricing). **Add an OpenAI/`gpt-5.5` table** for Codex.
- `~/.claude/readout-cost-cache.json` / `readout-codex-cost-cache.json` — per-day
  per-model token sums (ccusage's model).

```
cost = (input·in + cache_read·cacheRead + cache_creation·cacheWrite + output·out) / 1e6
```
Claude `usage` is **per-turn → must sum** all assistant events. Codex gives the
cumulative total directly. **Dedupe by `(requestId, message.id)`** — streamed
assistant chunks can repeat a `requestId` (ccusage does this).

## 5. Caching & refresh cost

- **Tail-read only.** Transcripts reach **14 MB** here. For status/preview/context%,
  seek to EOF and read back the last ~32–64 KB to the last complete line. The last
  assistant `usage` + last event give all four signals.
- **mtime cache:** `{file → (mtime, parsedSignals)}`; re-parse only on mtime change.
  Per tick = `ps`+`lsof` (cheap) + a `stat()` per agent. Most ticks are cache hits.
- **Incremental cost:** remember `(byteOffset, runningTotals)` per file; each tick
  read only appended bytes, add their `usage`. Codex needs none of this — one tail
  line (`token_count.total_token_usage`) is the whole-session total.

## 6. Module structure

```
zadar/
  src/
    collectors/
      process.ts      # ps/lsof → live agent PIDs, cwd, model, uptime, rss
      system.ts       # mem/swap/load (sysctl, vm_stat) — from bash fleet
      servers.ts      # dev-server listeners (lsof) — from `ports`
      worktrees.ts    # per-repo worktree status — from bash fleet
    transcript/
      claude.ts       # tail-parse → status, preview, context%, usage
      codex.ts        # tail-parse → status, preview, context%, usage
      status.ts       # shared status-inference rules
      pricing.ts      # price tables + cost(usage) ; reuse readout-*.json
    store.ts          # mtime cache, incremental cost, poll loop
    types.ts          # Agent, DevServer, RepoWorktrees, SystemStat, …
    components/        # see DESIGN.md → OpenTUI mapping
      Header.tsx  AgentList.tsx  AgentRow.tsx  AgentDetail.tsx
      OpsStrip.tsx  Footer.tsx  Confirm.tsx  HelpOverlay.tsx
    actions.ts        # kill server / prune worktree / copy resume (confirm-guarded)
    App.tsx           # layout + responsive tier + keybindings + poll
    index.ts          # createCliRenderer bootstrap
```

## 7. OpenTUI integration

- `bun add @opentui/core @opentui/react react@^19.2` — pin exact 0.3.x. **No Zig**
  (prebuilt `@opentui/core-darwin-arm64`). `bin: { fleet: "./src/index.ts" }`,
  shebang `#!/usr/bin/env bun`.
- Bootstrap: `const r = await createCliRenderer({ exitOnCtrlC:true, targetFps:30 });
  createRoot(r).render(<App/>)`.
- Poll via `setInterval` + `useState`; responsive via `useTerminalDimensions()`;
  keys via `useKeyboard()`; large lists in `<scrollbox>` (culling).

## 8. Reliability matrix

| | Reliable | Heuristic / flaky | Not yet |
|---|---|---|---|
| **Claude** | PID/cwd/model, active file, per-turn tokens, context% (w/ lookup), cost, **waiting-on-question** (structured), wait-time | tool-approval "waiting", multi-agent-same-cwd disambiguation w/o `--resume`, idle-threshold tuning | exact compaction marker (inferred from usage drop) |
| **Codex** | cwd & model & window (in-file), context%, cumulative tokens, cost (w/ OpenAI table), preview, working/done | blocked-on-question (text heuristic) | live PID→file mapping unverified (no Codex running at spec time) |
| **openclaw** | — | — | no data/format present |
