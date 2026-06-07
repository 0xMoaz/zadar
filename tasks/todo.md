# fleet — 10× overhaul loop

Goal: make the interface + product 10× better than the starting spec. Each
iteration delivers a concrete, durable improvement and is critiqued against the bar.

## The 10× bar

| # | Dimension | 1× → 10× | status |
|---|---|---|---|
| 1 | Real | mockup → running OpenTUI app | ☑ runs + typecheck + headless + interaction tests |
| 2 | Hero signal | static list → "who's waiting on me" unmissable + literal question | ☑ designed |
| 3 | Visual craft | rough boxes → real type/space/color system | ☑ designed |
| 4 | Calm density | → max signal, min noise; escalate-only | ☑ designed |
| 5 | Interaction | none → nav/expand/act/filter/search | ☑ nav+copy+kill(confirm)+help+refresh (filter deferred) |
| 6 | Truthful data | mock → all 4 signals derived (Claude+Codex) | ☑ LIVE (Claude); Codex stub |
| 7 | Responsive | fixed → reflows by split width | ☑ designed |
| 8 | Performance | → smooth refresh, no flicker/stall | ☐ designed, unproven |
| 9 | Delight | → calm micro-moments | ◐ partial |
| 10 | Robust | → empty/edge states, never crash | ☑ designed |

## Iteration log

### Iter 1 — grounding + design leap ✅
- 3 parallel research agents: OpenTUI 0.3.2 caps · best-in-class TUI patterns · data feasibility (verified on real files).
- Wrote DESIGN.md (design system + responsive layout + mockups) + ARCHITECTURE.md (data layer) + README value-prop.
- Key unlock: Claude's `AskUserQuestion` tail event → show the literal blocking question. No Zig needed (prebuilt binaries).

### Iter 2 — scaffold + render the shell ✅
- [x] Manual init; pinned @opentui 0.3.2; `bin: fleet`; **no Zig** (prebuilt arm64).
- [x] Builds + typechecks + renders headlessly (src/smoke.tsx via captureCharFrame).
- [x] types.ts (Agent, DevServer, …) from ARCHITECTURE §6.
- [x] Header / AgentList / AgentRow / AgentDetail / OpsStrip / Footer in the
      DESIGN.md language (palette, glyph rail, selection gutter, escalate-only).
- [x] Responsive tier switch (wide master-detail ↔ narrow accordion) via useTerminalDimensions.
- [x] Keyboard nav (j/k/g/G, q) + selection.
- Learned: must wrap React render in `act()` for headless capture (testRender does this);
  list rows go compact in the master-detail pane (cost/time live in detail) to avoid wrap.

### Iter 3 — wire live data ✅
- [x] collectors/process.ts (ps/lsof, model/resume parse, **never stores raw cmd**) + transcript/claude.ts → LIVE agents.
- [x] pricing.ts (opus/sonnet/haiku + gpt tier); incremental cost via byte-offset cache + (requestId,msg.id) dedupe.
- [x] system/servers/worktrees collectors (ported from bash); swap formatted to G.
- [x] collect.ts assembler (sorts waiting-first) + poll loop in App (2s) + probe.ts + livesmoke.tsx.
- [x] VERIFIED on real data: caught omnipair agent blocked 1h17m with its literal question; this session shown working w/ context%+cost.
- Codex: stubbed (no live Codex to verify against) → iter 4.

### Iter 4 — actions + polish + audit ✅
- [x] actions.ts: copy `claude --resume`, kill agent — with inline y/n confirm + toast. VERIFIED via headless keytest.
- [x] `?` help overlay + `r` refresh; footer made honest (dropped unimplemented `/` filter hint).
- [x] Crafted centered empty state.
- [x] Servers collector: confirmed NOT a bug — node:7266 was "Raycast Beta Backend", correctly excluded.
- [x] README updated to "working prototype" + run/keys.

### Final 10× audit (vs the bar)
- ✅ 8/10 dimensions fully met: Real, Hero, Visual craft, Calm density, Responsive, Truthful(Claude), Performance(sound), Robust.
- ◐ Interaction: filter/search deferred (removed from UI, not faked).
- ◐ Delight: escalate-only + literal-question reveal land; spinner/motion deferred.
- ◐ Codex: process shown, transcript parsing stubbed (no live Codex to verify).

### Stability fixes (after first real Ghostty run — "random sessions then it dropped")
- [x] **"it dropped"**: `esc` was bound to quit + mouse tracking on → moving the mouse / arrows / esc quit the app. Fixed: esc only cancels confirm/help, `useMouse:false`, quit is `q`/ctrl-c only.
- [x] **"random sessions"**: duplicate/subagent procs all resolved to a transcript → deduped agents by sessionId (prefer the real owner by context/cost).
- [x] **fan/CPU (the "sound")**: collect spawned ~25-40 subprocesses every 2s. Cached cwd (per-pid, immutable), branch (10s TTL), worktrees (15s TTL) → steady-state tick **620ms → 170ms**.
- [x] Robustness: `unhandledRejection`/`uncaughtException` guards (dashboard never dies on a stray async error); `renderer.destroy()` on quit restores the terminal cleanly.

### Known follow-ups (honest gaps, not broken promises)
Codex transcript parsing · ScrollBox + scroll-to-selected for 15+ agents · `/` filter ·
working-spinner w/ reduced-motion · context% reads low right after some turns (uses last-usage occupancy).

## Deferred (roadmap, not v1)
Remote machines · budget alerts/automation (Nightwatch) · transcript search ·
config-hygiene audit · embedded AI assistant. (Readout owns these today.)
