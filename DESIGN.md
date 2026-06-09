# fleet — Interface Design System

> The visual + interaction spec for the OpenTUI rewrite. Grounded in OpenTUI
> 0.3.2 capabilities and patterns from the best terminal UIs (lazygit, lazydocker,
> btop, k9s, atuin, glances). Companion to [ARCHITECTURE.md](./ARCHITECTURE.md)
> (the data layer) and [README.md](./README.md) (the product).

> **v2 addendum (shipped):** the agent row is now ONE calm line at rest with a
> uniform vitals column; urgency auto-expands beneath it (urgency = height).
> New states: `◆ ready` (turn finished, badged with its `+/-` diff) and `?`
> unknown. `▲ waiting` now also covers tools pending > 2m (approval or hung).
> The wordmark is a beacon (worst-case tint + per-state counts + fleet $/h);
> the working glyph pulses only on real transcript writes; idle rows decay;
> compaction leaves a fading ghost on the context bar; a flight-recorder
> ticker collects every status flip (`t`). Desktop notifications fire on
> flip-to-waiting with the literal question as the body (`n`). Worktrees
> drill open for guarded pruning (`p`). Enter discloses; `c` copies; `o` opens.

## North star

> An always-open terminal pane that, in **under one second of glance**, tells you
> *which of your parallel agents needs you right now* — and shows you the exact
> question it's blocked on — while staying calm enough to live in your peripheral
> vision all day.

## The hero: the "waiting-on-you" superpower

The single feature that justifies fleet existing. When a Claude agent blocks on a
question, its transcript ends in a structured `AskUserQuestion` event. fleet reads
that and surfaces **the literal question** — not just a "waiting" badge:

```
▲ webapp · fix/auth   waiting · 8m
  "Should I overwrite the existing config at app/config.ts?"
```

Across 4+ parallel worktrees this is the difference between *noticing an agent
stalled 8 minutes ago* and *losing 8 minutes per stall*. Everything else in the UI
exists to support this glance. Design rule: **a waiting agent is the only thing
allowed to be loud.**

## Principles

1. **Escalate-only color.** The resting UI is near-monochrome. Hue appears *only*
   where attention is owed: a waiting agent, a context bar near its limit, a
   memory-critical server. A *working* agent is calm. If everything's fine, the
   screen is quiet.
2. **One status rail.** Every agent's state lives in a single left-most glyph
   column, so the eye scans one vertical line to triage the fleet.
3. **Depth on demand.** Rows are one calm line; richness (the question text,
   recent activity, cost breakdown) lives in the detail pane / accordion, one
   keystroke away. Never a wall of text at rest.
4. **Selection is quiet.** A 1-char left accent bar + bold weight marks the
   selected row — never a full-row background fill (loud, fights the calm).
5. **Flicker-free or it's not calm.** Diff-render, on-demand frames, 1–2 Hz poll.
   A pane that twitches can't be ambient. Honor `prefers_reduced_motion`.
6. **Responsive, one component.** The same agent component reflows from a wide
   master-detail split → a narrow single-column accordion. Yoga +
   `useTerminalDimensions` do the work.
7. **The chrome reports the worst case.** The header/frame tints to the most
   urgent agent's state, so even glancing at the *edges* tells you if anyone
   needs you (k9s context-coloring).

## Visual system

### Palette (escalate-only)

| Role | Hex | Used for |
|---|---|---|
| `fg` | `#C8CDD4` | primary text |
| `dim` | `#6B7280` | labels, secondary, separators, resting glyphs, sparkline texture |
| `faint` | `#3B4048` | rules, inactive borders, bar troughs |
| `accent` | `#56B6C2` (cyan) | **focus only** — active panel border + selected-row gutter |
| `attention` | `#E6B450` (amber) | **escalation** — waiting-on-you, context 70–90%, wait > 1m |
| `danger` | `#E05252` (red) | error, context > 90%, wait > 5m, mem critical |
| `positive` | `#7FB069` (muted green) | used *sparingly* — only "✓ passed / done" micro-marks |

Discipline: **cyan = focus, amber = needs attention, red = urgent.** Cost and
normal context% stay monochrome. No green→yellow→red decoration anywhere it isn't
genuinely actionable. (glances' "blue/calm before red" idea: the first escalation
step is amber, not red — red is reserved for *truly* urgent.)

### Status glyph vocabulary (the rail)

| Glyph | State | Color |
|---|---|---|
| `●` | working | `dim` (calm; optional spinner only if motion enabled) |
| `○` | idle | `dim` |
| `▲` | **waiting on you** | `attention` |
| `✕` | error | `danger` |

One glyph, one column, always left-most. A `·codex` tag (dim) distinguishes
Codex agents from Claude.

### Data-viz in text

- **Context bar:** 6–8 cells `▰▱`. Desaturated (`dim`) 0–70%, `attention`
  70–90%, `danger` >90%. Always paired with a right-aligned tabular `%`.
- **System sparkline:** braille (`⠀⣀⣤⣶⣿`) preferred, block (`▁▂▃▅▆█`) fallback,
  rendered in `dim` as *texture*, never a focal point. (Tiered by terminal
  capability: `braille | block | ascii`.)
- **Numbers are tabular + right-aligned:** cost `$3.90`, context `96%`, wait
  `8m`, mem `14G`. Fixed-width columns, 2–3 space gutters — this is where
  monospace breathes.

### Borders & spacing

- `rounded` borders, thin. Prefer **whitespace and thin rules over boxes** —
  only the top-level regions get borders; rows are separated by space, not lines.
- Active region: `accent` border. All other borders: `faint`. (lazygit's
  focus-only coloring — most of the "calm" comes from this one rule.)
- Vertical rhythm: one blank line between logical groups; selected row gets
  `scrollOff` margin so it never sits against an edge.

## Layout — three-zone frame, responsive

```
┌ header ─ worst-case-tinted summary + system vitals + clock ┐
│ body   ─ AGENTS (hero) + detail                            │
└ footer ─ dim, context-sensitive keybinding hints ──────────┘
```

### Wide (≥ 100 cols) — master-detail (lazydocker)

```
 fleet   4 agents · 1 ▲ waiting · 2 working       ram 58%  swap 5.5G  load 4.7      23:25
╭ agents ─────────────────────────────────╮╭ webapp · fix/auth · opus-4.8 ──── ◷40m ╮
│   ● zefleet  main      71% ▰▰▰▰▰▱  $1.24 ││                                        │
│   ● omnipair  feat      28% ▰▰▱▱▱▱  $0.31 ││ ▲ waiting for you · 8m                  │
│ ▎▲ webapp     fix/auth  96% ▰▰▰▰▰▰  $3.90 ││   "Should I overwrite the existing      │
│   ○ argo·codex agent-3  31% ▰▰▱▱▱▱  $0.12 ││    config at app/config.ts?"           │
│                                          ││                                        │
│                                          ││ context ▰▰▰▰▰▰▰▰ 96%  near limit        │
│                                          ││ cost    $3.90 · 192k tok               │
│                                          ││ ─────────────────────────────────────  │
│                                          ││ recent                                 │
│                                          ││   ✓ ran  bun test → 42 pass            │
│                                          ││     edit app/config.ts                 │
│                                          ││     read app/config.ts                 │
╰──────────────────────────────────────────╯╰────────────────────────────────────────╯
 ↑↓ move   ⏎ attach   x kill   p prune   / filter   ? help
```

Master ~40%, detail ~60%. Selected row: `▎` accent gutter + bold. The detail pane
swaps entirely per selection (Activity / Output / Cost views via `tab`).

### Narrow (60–99 cols) — single-column accordion

```
 fleet · 4 agents · 1 ▲ waiting              23:25
 ram ⣀⣤⣶ 58%   swap 5.5G   load 4.7
 ─────────────────────────────────────────────────
 AGENTS
   ● zefleet   main      71% ▰▰▰▰▰▱   $1.24
   ● omnipair   feat      28% ▰▰▱▱▱▱   $0.31
 ▎▲ webapp      fix/auth  96% ▰▰▰▰▰▰   $3.90
     waiting · 8m
     "Should I overwrite app/config.ts?"
     recent  ✓ bun test → 42 pass · edit config.ts
   ○ argo·codex agent-3   31% ▰▰▱▱▱▱   $0.12
 ─────────────────────────────────────────────────
 servers  :3000 omnipair 14G⚠   :3001 webapp 9.8G
 ─────────────────────────────────────────────────
 ↑↓ move   ⏎ expand   x kill   ? help
```

Selected agent expands **inline** (accordion) to reveal the question + recent
activity. Ops (servers/worktrees) demote to a compact footer strip that only
colors when something's wrong.

### Degradation tiers (by width, then height)

| Width | Drop |
|---|---|
| < 100 | master-detail → single-column accordion |
| < 70 | sparklines → just `%`; model id hidden |
| < 50 | context bar → `%` only; cost only on selected |
| short height | footer collapses to `?`; ops strip hides unless alerting |

## Interaction

### Keymap (vim-first, discoverable)

| Key | Action |
|---|---|
| `j`/`k` `↓`/`↑` | move selection |
| `g`/`G` | first / last agent |
| `Tab` / `1-3` | switch detail view (Activity / Output / Cost) or focus region |
| `Enter` | attach to selected session (or expand, narrow mode) |
| `x` | kill (server) — confirm |
| `p` | prune worktree — confirm |
| `c` | copy `claude --resume <id>` to clipboard |
| `/` | filter agents (live) |
| `r` | force refresh |
| `?` | help overlay |
| `q` / `Esc` | quit |

Footer always shows the relevant subset (dim). `?` opens a full overlay.

### Actions (act-with-confirm)

Destructive actions (kill, prune) show an inline confirm with the exact target
(`kill node :3000 (omnipair, 14G)?  y/n`). Never a blind keypress. After an
action, fleet re-scans so the view is immediately truthful. (Automation —
threshold reaping, alerts — is roadmap, not v1; see README.)

## Motion

- **Refresh:** 1–2 Hz poll (matches the bash `-w`). On-demand render — idle costs
  nothing. OpenTUI's double buffer prevents flicker.
- **What animates:** only the working-spinner and a brief value-tween on the
  context bar when it changes. Nothing else moves.
- **`prefers_reduced_motion`:** disables spinner + tweens → pure static updates.

## States

- **Empty / no agents:** centered, whitespace-forward, one dim line (`no active
  agents`) + 2–3 shortcut hints. This is the resting face — make it serene, not
  blank. (neovim-dashboard aesthetic.)
- **Single agent:** detail pane auto-focuses it.
- **Many agents:** master list is a `ScrollBox` (viewport culling); selection
  keeps `scrollOff` margin.
- **Error/unreadable transcript:** agent still shows from process data; detail
  notes "transcript unavailable" rather than vanishing.

## OpenTUI mapping (grounding)

| UI element | OpenTUI primitive |
|---|---|
| regions / panels | `<box>` rounded, `borderColor` = focus state |
| header / footer | `<box flexDirection="row" justifyContent="space-between">` |
| agent rows | `<box>` per row; `<text>` with `t`-template per-char color |
| master list (scroll) | `<scrollbox scrollY>` (culling) |
| detail / recent | `<box flexDirection="column">` + `<text>` |
| filter input | `<input>` |
| context bar / sparkline | `<text>` of bar glyphs, per-cell `fg` |
| responsive | `useTerminalDimensions()` → switch `flexDirection` / tier |
| keys | `useKeyboard()` |
| selection state | React `useState`, `dim`/bold via `attributes` |
| spinner / tween | `useTimeline()` (gated by reduced-motion) |

> Pin `@opentui/core` / `@opentui/react` to an exact 0.3.x — the API churns
> pre-1.0. No Zig required (prebuilt darwin-arm64 binary ships via npm).
