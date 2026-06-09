# fleet v2 — "living fleet" overhaul

Branch: `overhaul/v2-living-fleet`. Goal: precision (the display never lies),
progressive disclosure (calm = 1 line, urgency = height), and decoration that
carries signal (pulse, decay, ticker, beacon). One commit per checked cluster.

## Phase 0 — baseline
- [x] Capture before-frames from main (`/tmp/zefleet-before-frames.txt`)
- [x] Branch created
- [ ] Plan committed

## Phase 1 — truth layer (the display never lies)
- [ ] Pure status engine `src/transcript/status.ts` + unit tests (fixtures):
      waiting-question · waiting-approval (pending tool_use > 2m) · working
      (recent mtime / fresh tool) · **ready** (turn ended, unreviewed, < 20m)
      · error (turn died on is_error tool_result) · idle
- [ ] Per-event model pricing in accrueCost (sessions switch models)
- [ ] Worktree-aware identity: `webapp/fix-auth` (repo kept, wt name shown)
- [ ] Honest kill: verify the process died before toasting "killed"
- [ ] Dedupe surfaces shared procs (`×2`) instead of silently hiding one
- [ ] Codex: honest `?` unknown status (no fake "working")
- [ ] Drop unused `ws` dep

## Phase 2 — disclosure layout (calm = 1 line)
- [ ] One-line agent rows: glyph · project/wt · branch · ctx · cost
- [ ] Auto-expand waiting + error rows (urgency = height)
- [ ] Enter/→ toggles per-row detail: full question + option chips ①②③,
      recent activity (wire the dead `recent[]`), tokens · model · cwd, resume
- [ ] `c` copies (Enter no longer copies); `o` opens (app / browser URL)
- [ ] Selection by sid, not index (stable across re-sorts)
- [ ] Chrome diet: drop outer border, tighten padding; height tiers
- [ ] Footer honesty: `i 4 idle`, contextual `p prune` / `o open`

## Phase 3 — living signal (decoration with purpose)
- [ ] Header beacon: `fleet ▲1 ●2 ◆1` + worst-case tint (wordmark + rule)
- [ ] Truthful pulse: working glyph brightens only when transcript advanced
      since the previous tick (no fake spinner)
- [ ] Typographic decay: idle rows fade by age (fg → dim → faint)
- [ ] Ready state ◆ + diff badge `+214 −38` (git diff --shortstat, TTL cache)
- [ ] Burn rate: `$/h` per agent (windowed) + fleet total in header
- [ ] Compaction ghost: high-water mark cells linger dim after occupancy drop
- [ ] Transition ticker: ring buffer of status flips; 1 dim line above footer;
      `t` toggles the full log

## Phase 4 — reach (act without switching)
- [ ] Notify on flip→waiting: osascript notification + sound; `n` toggles
- [ ] Worktree drill-in: per-wt rows (name · branch · dirty · age); `p` prunes
      clean trees with confirm
- [ ] `o` on agent: claude:// deep-link spike, fallback `open -a Claude`
- [ ] `o` on server: open http://localhost:port

## Phase 5 — hardening + PR
- [ ] Unit tests green (`bun test`): status engine, pricing, naming, formats
- [ ] Headless interaction tests: nav stability across re-sort, expand, fold,
      confirm flow, toggles
- [ ] Mock covers every state; smoke at 100×36 / 72×40 / 60×20; fix act() warning
- [ ] README + DESIGN updated to match what ships
- [ ] After-frames; PR with before/after captures + change narrative

## Review log
(appended as phases land)
