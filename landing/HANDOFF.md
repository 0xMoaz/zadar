# Handoff — zadar landing & live demo

**Date:** 2026-06-12 · **Repo:** `~/Code/zefleet` (the `zadar` TUI, published as `zadar` on npm)
**Active focus:** the marketing page for **zee.gg/zadar**, centered on a **live animated terminal demo**.

---

## TL;DR — where things stand

- **`landing/src/ZadarDemo.tsx`** is the deliverable: a **self-contained React + Motion component** that renders *one persistent zadar terminal* where a scripted scenario plays out live (a Needs-you item gets pushed in, an agent flips `working → waiting`, pills tick, etc.). Built to drop into the user's **Next.js zee.gg `/zadar` route**.
- It's **working and verified** across the whole loop. Theme = **GitHub Dark in OKLCH**, **near-pitch-black** bg, **fixed window size** (680 × 413, zero variance).
- Dev harness is **Vite + bun** in `landing/`, served on **port 7791** (`bun run dev`). Preview/verify with the `preview_*` MCP tools.
- **Everything in `landing/` is uncommitted.** Separately, the **user has uncommitted in-progress edits to the app** (`src/App.tsx`, `src/components/AgentBlock.tsx`, `src/app.test.tsx`, `src/theme.ts`) — **do not commit those without asking.**

---

## How this evolved (so you don't repeat dead ends)

The terminal demo went through three iterations:
1. **Static captured frame** — `gen.tsx` rendered the real `App` headless via `@opentui/react/test-utils`, captured the exact span grid (`captureSpans()`), converted to colored HTML, injected into a static `index.html`. Pixel-exact but static.
2. **Rotating vignettes** — 4 captured frames cross-faded on a timer. The user rejected this: they want **one terminal with scenarios happening inside it**, not swapped snapshots.
3. **Live React + Motion component (current)** — hand-built DOM rows + a scripted timeline + Motion animations. This is `ZadarDemo.tsx`.

`gen.tsx` and the old static page are **retired**. `landing/_legacy-page.html` preserves the old static hero/install/features markup (for porting to React later). `gen.tsx` can be deleted.

---

## The `landing/` project

```
landing/
  package.json        # bun; deps: react, react-dom, motion (^11). vite + plugin-react.
  vite.config.ts      # port 7791, strictPort
  tsconfig.json
  index.html          # Vite entry; loads JetBrains Mono from Google Fonts
  src/
    main.tsx          # renders <ZadarDemo/> (NO StrictMode — would double-run the timeline)
    ZadarDemo.tsx     # ★ the live terminal — the deliverable
    zadar-tokens.ts   # exact colors/glyphs (OKLCH) + sparkline/ctxBar/projectHue ported from the app
    styles.css        # @font-face ZadarSymbols, --bg/--panel/--line, body centering
  assets/
    zadar-icon.png        # the logo (from Figma, node 278:612)
    zadar-symbols.woff2    # 2.5KB subset of JetBrainsMono NF — ONLY the git-branch glyph U+F418
  _legacy-page.html   # old static page (hero/install/features) — port source
  gen.tsx             # RETIRED capture pipeline — delete
```

**Run & verify:**
```bash
cd landing && bun install    # if needed
# preview via MCP: preview_start "landing"  (config in .claude/launch.json → bun run dev on :7791)
bun run tsc --noEmit         # typecheck (run from landing/)
```
Verify visually with `preview_screenshot`; the loop is ~18s so successive screenshots catch different beats. Check `preview_console_logs` for errors.

---

## `ZadarDemo.tsx` architecture

- **Fleet model** (`Fleet` type): `{ beacon, pills, burn, queue: QItem[], agents: Agent[], lit }`. The UI is a pure render of this.
- **Scenario** = `beats()`: an array of `{ fleet, hold }`. A `setTimeout` chain in an effect steps through them, looping. Each beat sets a *whole* `Fleet`; React diffs it, Motion animates the change.
- **The loop (truthful to the app's real inference rules):**
  1. **Calm** (3.4s) — 3 working agents (`⠋`/`●`), "✓ nothing needs you".
  2. **Question** (4.2s) — webapp `working → waiting`: glyph `⠋ → ▲` (fg→amber), a Needs-you item springs in (`✻ webapp …` + wrapped question + `① ②` chips), header `●3→●2`+`▲1` springs, wordmark cyan→amber, legend `▲ waiting` lights.
  3. **Answered** (0.9s) — chip `①` flashes accent (`pressed`), then the next (calm) beat clears it.
  4. **Review** (3.6s) — zefleet `working → ready` (`◆`, green), Needs-you review item + diff, header `◆1`.
  5. **Server** (2.8s) — a `webapp · :3000 holding 14GB memory` item springs in **above** review (severity order; server-mem < ready).
  6. → **Calm**, loop.
- **Motion:** `<AnimatePresence mode="popLayout">` + `layout` around the queue (items spring/slide in & out via `height:0↔auto`); `motion.span` color-morphs the agent glyph & wordmark; pills spring in/out; chips stagger.
- **Truthful spinner:** a 120ms `tick` interval. `statusGlyph()` shows the braille `WORK` frame **only** when `status==="working" && advancing`; a working-but-stalled agent (api-gateway) stays a static `●`. Questions show the `SPARKLE` frames. **Motion never lies — keep this invariant.**
- **`prefers-reduced-motion`:** holds the question beat statically, no loop/spinner.
- **Fixed window:** root `width: min(680px, 92vw)` (definite → no shrink-wrap). Screen is `height: 372px, display:flex, flexDirection:column, overflow:hidden`; a `flex:1 1 auto` spacer bottom-pins the footer. **372px fits the tallest (question) beat — re-check if you add rows.**

### Fidelity is anchored to the real app
The rows match `src/components/{AgentBlock,QueueItem,Footer,SectionHeader,StateLegend}.tsx` and `src/theme.ts`. Layout uses flexbox `space-between` (left identity / right vitals) with `whiteSpace:pre`; the working-agent vitals are **padded to fixed widths** (EKG 12 · bar 6 · `pct` padStart(3)+% · ghost · cost padStart(6)) so columns align like the app's grid.

---

## Theme — GitHub Dark, OKLCH, near-pitch-black

Source: `terminalcolors.com/themes/github/dark` → `mbadolato/iTerm2-Color-Schemes` "GitHub Dark". Converted to OKLCH (sRGB→OKLab math; neutrals share hue ~253). In `zadar-tokens.ts` `C`:

| token | OKLCH | note |
|---|---|---|
| panel | `oklch(0.135 0.008 255)` | near-pitch-black terminal bg |
| (page `--bg`) | `oklch(0.09 0.006 255)` | in styles.css |
| fg | `oklch(0.857 0.014 248)` | |
| dim | `oklch(0.662 0.018 250.9)` | |
| faint | `oklch(0.425 0.017 254.7)` | |
| pill | `oklch(0.267 0.015 256.8)` | keycap bg |
| line | `oklch(0.33 0.015 252.3)` | border |
| accent | `oklch(0.716 0.137 258.3)` | GitHub **blue** (theme's ANSI cyan #2b7489 too dark for a wordmark) |
| attention | `oklch(0.79 0.139 85.2)` | yellow — waiting |
| danger | `oklch(0.73 0.15 34.1)` | red — error/mem |
| positive | `oklch(0.772 0.188 145.5)` | green — review |
| project hues | `oklch(… 252.3/299.1/349.5/202.1/55.1/150.3)` | GitHub bright accents |

Font: **JetBrains Mono** (Google Fonts, matches the user's Ghostty `JetBrainsMonoNLNerdFont`) + the `ZadarSymbols` subset for the branch glyph. Stack in `styles.css --term-mono`.

> The **real app** adopts the *terminal's* ANSI palette at runtime (`theme.applyTerminalPalette`), so to get GitHub Dark in actual zadar you set Ghostty's theme. The OKLCH values above are demo-only. If the user wants the app to *default* to GitHub Dark, bake hexes into `src/theme.ts`.

---

## Gotchas hit this session

- **`String.replace` `$` bug:** injecting JSON containing `$2.1/h` into HTML via a string replacement made `.replace()` interpret `$2` as capture-group-2 and inject a stray `</script>`. Use a **function replacement**. (Only relevant if you revive `gen.tsx`.)
- **Width shrink-wrap:** a panel with no definite-width ancestor sizes to content → varied per beat. Fixed with `width: min(680px, 92vw)`.
- **Height jump:** fixed via constant `height` + flex spacer + bottom-pinned footer.
- **StrictMode** double-runs the timeline in dev — `main.tsx` omits it. In Next.js, just render `<ZadarDemo/>` (it's `"use client"`).

---

## Open items / next steps

1. **Port the page** — turn `_legacy-page.html` (hero / install / features / footer) into `ZadarLanding.tsx` (React), apply the same OKLCH GitHub theme, so `/zadar` is a complete drop-in Next page. Install command shown: `bunx zadar`; curl installer note.
2. **Subset the warn glyph** `` (Nerd Font) like the branch glyph, so the server-mem row uses it instead of the current stand-in red `▲`. (`pyftsubset` is available; source font `~/Library/Fonts/JetBrainsMonoNLNerdFont-Regular.ttf`.)
3. **Commit** the `landing/` batch (its own commit). **Leave the user's app edits alone.**
4. Optional polish: EKG that slowly scrolls; scenario timing/caption tweaks; match Ghostty bg exactly if they share their value.

---

## Committed app work earlier this session (context)

5 commits on `main` (origin is behind; user pushes themselves):
- `e92af03` fix(transcript): judge freshness by last real turn, not file mtime — fixed the Needs-you flood (reopened-but-dormant sessions read as fresh). Claude: last real user/assistant turn; Codex: last content event skipping `token_count`.
- `7c6330e` feat(format): MB/GB memory units; wrap test teardown in `act()`.
- `704e2ab` feat(ui): animated braille work-glyph + state legend (replaced transition ticker) + ticker fix.
- `c9a3410` refactor(ui): legend leads with needs-you states.
- `ad03230` fix(context): default 1M-capable models (Opus 4.6+, Sonnet 4+, Fable 5) to a 1M window — fixes the "lying at ~99%" when a 1M session has no `[1m]` flag and occupancy is under 200k. `windowFor`/`supports1M` in `src/transcript/claude.ts`; tested in `claude.test.ts`.

**User's parallel uncommitted app edits** (visible in `git status`, made by them — honor, don't revert): "Sessions" → **"Active sessions"** label; boot-folds Active sessions when the queue has items (`open.sessions` seeded from `attentionQueue(snapshot).length === 0`); **pinned Needs-you** (never foldable) + **removed the idle toggle**; **footer alignment** (gap between chips, not trailing); a **tree-style disclosure** in `AgentBlock` (`├─ └─` rails); `initialOpen` + `demo` props on `App`.

## Reference

- Approved plan: `~/.claude/plans/greedy-puzzling-penguin.md`
- The faithful visual+behavior spec was generated by an Explore agent (not saved); re-derive from `src/theme.ts`, `src/components/*`, `src/transcript/status.ts` if needed.
- User prefs: **bun** always; check `ports` before binding; concise; TypeScript strict; craftsmanship over speed. Products start with `z`; "zadar" passed the say-it-aloud test.
