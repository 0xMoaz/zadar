# pre-launch architecture pass — 2026-06-12

Report: `$TMPDIR/architecture-review-20260612-174737.html` (C1–C7).
Rule of the pass: identical observable behavior, strictly less work.

## C1 — transcript freshness decided once
- [x] mtime-gated tail cache in claude.ts + codex.ts (skip read+parse when unchanged)
- [x] TTL the discovery sweeps (claude project-dir pick ~5s, codex day-walk ~10s);
      always stat the chosen file fresh so live signals never lag
- [x] claude 1MB task dig retries on a 10s TTL while unfound (review caught that a
      one-shot "" sentinel could blank the task line for a whole session)

## C2 — batch the probes, run collectors concurrently
- [x] servers.ts: one batched `ps -p p1,p2,…` for all listeners (was 1+3×N serial)
- [x] collect.ts: per-agent git lookups in parallel; servers/worktrees start
      concurrently with the agent loop; burn/ghost mutation stays sequential

## C3 — derive the view model at poll rate, not spinner rate
- [x] useMemo the derived chain (counts, queue, groups, rows) on [snap, folds]
- [x] React.memo pure cards; animated components receive tick only while animating

## C4 — cache lifecycle
- [x] SessionCache (transcript/cache.ts): touch-and-sweep, 5min unused → dropped

## C5 — seam hygiene (zero-risk slice only)
- [x] shared snippet() in status.ts; codex thresholds use named constants
      (full TranscriptSignals unification deliberately deferred — see report C5)

## C6 — error observability
- [x] swallowed unhandledRejection/uncaughtException append to ~/.zadar/errors.log
      (256KB cap, rotated to .1 at launch)

## Verify
- [x] 110 tests green (+1 new: codex tail-cache busts on file change) · tsc clean ·
      smoke renders · live probe correct on this machine

## Review log

- **Audit**: 4 parallel Explore agents + manual verification of every hot file.
  Report: `$TMPDIR/architecture-review-20260612-174737.html`. View-layer seams
  (fleetmap/format/theme/history, real–mock) confirmed healthy by deletion test.
- **Measured** (same machine, 1 active agent + 1 server): warm tick 210–290ms →
  ~87ms; cold 946ms → ~650ms. Gap widens with more listeners/idle agents.
- **Equivalence**: old-vs-new parseClaude on the identical live transcript →
  byte-identical signals. Old/new collect() compared live.
- **Adversarial review** (code-reviewer agent over the diff) found 3 fix-first
  items, all fixed: sticky "" task sentinel (→ 10s re-dig TTL), codex negative
  walk cache (→ negatives not cached, found-only), errors.log rotation comment
  was a lie (→ real rotation at launch). Everything else verified clean.
- **Accepted relaxation** (documented, not silent): a NEWER session file in an
  already-watched cwd is picked up within ≤5s (claude) / ≤10s (codex) instead of
  ≤2s — same class as the existing 15s worktree cache. First sessions and all
  live-file signals are unaffected (chosen file is stat'd fresh every tick).
- **Deferred**: C5-full (one TranscriptSignals seam), C7 (App.tsx selection/fold
  hooks — wait for a forcing feature). Pre-existing quirk flagged: codex
  turn_context model scan takes the OLDEST match (spawned as separate task).

---

# fleet v3 — attention queue + project map

Branch: `overhaul/v3-attention-queue` (off v2). The rethink: **attention is
the primary axis, not resource type**. A ranked NEEDS-YOU queue unifies every
actionable item (questions, approvals, errors, reviews, sick servers); below
it a *stable, alphabetical* project map — urgency reorders the queue, never
the map (spatial memory stays intact). `v` toggles back to the v2 type view.

## Phase A — Codex truth (the honest gap)
- [x] transcript/codex.ts: session discovery (scan recent days, match
      session_meta.cwd, cache path→cwd), token_count info → ctx% + cost,
      task lifecycle → working/ready/idle, agent_message previews,
      plan-quota % (rate_limits) — grounded against real files
- [x] tests with synthetic fixtures matching the real shapes
- [x] wire into collect; codex rows get real vitals

## Phase B — the model (pure + tested)
- [x] fleetmap.ts: groupByProject (agents + servers + worktrees → one
      entity; identityOf applied to server cwds) — alphabetical, stable
- [x] attentionQueue: ranked items (question > approval > error >
      server-mem > ready > ctx-high > stale-server), action-sentence titles

## Phase C — the new face
- [x] NEEDS YOU zone: queue items with inline chips; Enter expands the
      underlying entity in place; x/o/c act directly
- [x] PROJECTS zone: one card per repo — status glyph, agents ·server ·trees
      summary, cost; Enter expands to full agent/server/worktree rows
- [x] `v` toggles classic v2 type view (components shared)
- [x] empty queue = the calm face: "nothing needs you"

## Phase D — living layer
- [x] EKG rhythm: per-agent activity sparkline from tail timestamps
      (catches stalls and retry-loops at a glance)
- [x] project identity hues: 1-cell chip per project, muted, never on text
- [x] flight recorder persists to ~/.zefleet/events.jsonl; today's log
      reloads on boot; empty state shows today's story
- [x] codex plan-quota in detail meta

## Phase E — hardening + PR
- [x] interaction tests for queue nav/actions, map expand, view toggle
- [x] smoke shots incl. queue-empty serene state; typecheck; full suite
- [x] README/DESIGN v3 addendum; PR with base = v2 branch (3-way lineage:
      main = v1, v2 branch, v3 branch)

## Review log

- **Phase A** (1 commit): Codex parser grounded against real ~/.codex files
  before writing a line — token_count info can be null (rate_limits still
  present); session_meta first lines reach tens of KB (headLine reads 128KB).
  6 fixture tests.
- **Phase B** (1 commit): groupByProject + attentionQueue pure and tested
  (9 tests) before any UI. identityOf/STATUS_RANK unified in fleetmap.
- **Phase C** (1 commit): two-view App; queue items carry their targets so
  o/c/x act through them. Tests caught two honest assertion bugs (viewport
  culling; at-rest rows no longer show activity by design).
- **Phase D** (1 commit): EKG from real timestamps, identity hues on 1-cell
  dots only, flight recorder persists + reloads today.
- **Phase E**: 85 tests green; live probe re-verified on this machine.


---

# fleet v2 — "living fleet" overhaul

Branch: `overhaul/v2-living-fleet`. Goal: precision (the display never lies),
progressive disclosure (calm = 1 line, urgency = height), and decoration that
carries signal (pulse, decay, ticker, beacon). One commit per checked cluster.

## Phase 0 — baseline
- [x] Capture before-frames from main (`/tmp/zefleet-before-frames.txt`)
- [x] Branch created
- [x] Plan committed

## Phase 1 — truth layer (the display never lies)
- [x] Pure status engine `src/transcript/status.ts` + unit tests (fixtures):
      waiting-question · waiting-approval (pending tool_use > 2m) · working
      (recent mtime / fresh tool) · **ready** (turn ended, unreviewed, < 20m)
      · error (turn died on is_error tool_result) · idle
- [x] Per-event model pricing in accrueCost (sessions switch models)
- [x] Worktree-aware identity: `webapp/fix-auth` (repo kept, wt name shown)
- [x] Honest kill: verify the process died before toasting "killed"
- [x] Dedupe surfaces shared procs (`×2`) instead of silently hiding one
- [x] Codex: honest `?` unknown status (no fake "working")
- [x] Drop unused `ws` dep

## Phase 2 — disclosure layout (calm = 1 line)
- [x] One-line agent rows: glyph · project/wt · branch · ctx · cost
- [x] Auto-expand waiting + error rows (urgency = height)
- [x] Enter/→ toggles per-row detail: full question + option chips ①②③,
      recent activity (wire the dead `recent[]`), tokens · model · cwd, resume
- [x] `c` copies (Enter no longer copies); `o` opens (app / browser URL)
- [x] Selection by sid, not index (stable across re-sorts)
- [x] Chrome diet: drop outer border, tighten padding; height tiers
- [x] Footer honesty: `i 4 idle`, contextual `p prune` / `o open`

## Phase 3 — living signal (decoration with purpose)
- [x] Header beacon: `fleet ▲1 ●2 ◆1` + worst-case tint (wordmark + rule)
- [x] Truthful pulse: working glyph brightens only when transcript advanced
      since the previous tick (no fake spinner)
- [x] Typographic decay: idle rows fade by age (fg → dim → faint)
- [x] Ready state ◆ + diff badge `+214 −38` (git diff --shortstat, TTL cache)
- [x] Burn rate: `$/h` per agent (windowed) + fleet total in header
- [x] Compaction ghost: high-water mark cells linger dim after occupancy drop
- [x] Transition ticker: ring buffer of status flips; 1 dim line above footer;
      `t` toggles the full log

## Phase 4 — reach (act without switching)
- [x] Notify on flip→waiting: osascript notification + sound; `n` toggles
- [x] Worktree drill-in: per-wt rows (name · branch · dirty · age); `p` prunes
      clean trees with confirm
- [x] `o` on agent: claude:// deep-link attempt + `open -a Claude` fallback
      (deep-link URL format unverified — needs a live check with Zee)
- [x] `o` on server: open http://localhost:port

## Phase 5 — hardening + PR
- [x] Unit tests green (`bun test`): status engine, pricing, naming, formats
- [x] Headless interaction tests: nav stability across re-sort, expand, fold,
      confirm flow, toggles
- [x] Mock covers every state; smoke at 100×36 / 72×40 / 60×20; fix act() warning
- [x] README + DESIGN updated to match what ships
- [x] After-frames; PR with before/after captures + change narrative

## Review log

- **Phase 1** (4 commits): status engine extracted pure + 16 fixture tests.
  Found and fixed the big one: permission-blocked agents rendered "working"
  forever. Worktree sessions now keep their repo. Kill toasts verified.
- **Phase 2** (2 commits): one-line rows, auto-expanded urgency, Enter
  discloses, sid selection. Smoke caught that `pressKey("return")` typed
  letters — the mock wants KeyCodes names.
- **Phase 3** (1 commit): beacon/pulse/decay/diff-badge/ghost/ticker, all
  driven by tested pure helpers in signal.ts. Burn-window trim needed an
  anchor sample (test caught it).
- **Phase 4** (1 commit): notifications, drill-in prune (dirty + live-agent
  guarded), open actions. Smoke caught a REAL pre-existing bug: shift+G
  arrives as g+shift, so jump-to-last had never worked.
- **Phase 5**: 62 tests green (status, pricing, identity, formats, signal,
  full keyboard interaction suite). Live probe verified against this very
  machine: correct branch, 1M-window math, recent trail, diff stat.
- **Verified live**: `bun run src/probe.ts` caught the session writing this
  log — model, branch, cost, context %, and uncommitted diff all correct.
