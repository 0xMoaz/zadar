import { RGBA, type TerminalColors } from "@opentui/core"
import type { AgentStatus } from "./types"

/**
 * Theme colors. Defaults are tasteful neutrals; at startup index.tsx calls
 * applyTerminalPalette() with the colors detected from YOUR terminal (Ghostty),
 * so fleet matches whatever scheme you run. `color` is a mutable singleton —
 * components read it at render time, so overriding before first paint is enough.
 */
export const color = {
  fg: RGBA.fromHex("#C8CDD4"),
  dim: RGBA.fromHex("#6B7280"),
  faint: RGBA.fromHex("#3B4048"),
  /** keycap background — a whisper above the terminal bg, never palette-overridden */
  pill: RGBA.fromHex("#262A30"),
  accent: RGBA.fromHex("#56B6C2"),
  attention: RGBA.fromHex("#E6B450"),
  danger: RGBA.fromHex("#E05252"),
  positive: RGBA.fromHex("#7FB069"),
}

/** Override the theme from the terminal's detected palette (16 ANSI slots + fg). */
export function applyTerminalPalette(tc: TerminalColors): void {
  const p = tc.palette ?? []
  const set = (key: keyof typeof color, hex: string | null | undefined) => {
    if (hex) color[key] = RGBA.fromHex(hex)
  }
  set("fg", tc.defaultForeground)
  set("accent", p[6] ?? p[4]) // cyan, else blue
  set("attention", p[3]) // yellow
  set("danger", p[1]) // red
  set("positive", p[2]) // green
  set("dim", p[8] ?? p[7]) // bright black / gray
  set("faint", p[8] ?? p[7])
}

// Nerd Font icons (Ghostty ships a built-in NF fallback, so these render
// even without a patched font). Identity, not decoration — used sparingly.
export const icon = {
  branch: "", // oct-git_branch — carries the project hue
  server: "", // oct-server
  repo: "", // oct-repo — projects ARE repos
  sessions: "✳", // the Claude Code asterisk (plain unicode)
  codex: "⬡", // hexagon echo of the OpenAI mark (plain unicode)
  up: "", // oct-arrow_up — update available
  // story-card labels
  task: "", // oct-tasklist
  pulse: "", // oct-pulse
  comment: "", // oct-comment
  diff: "", // oct-diff
  dir: "", // oct-file_directory
} as const

// the Claude Code sparkle — motion budget spent ONLY where attention is owed.
// frame 0 is the prettiest so static captures (smoke/tests) look right.
const SPINNER = ["✻", "✽", "✻", "✶", "✳", "✢", "·", "✢", "✳", "✶"] as const
export const spinnerFrame = (tick: number): string => SPINNER[tick % SPINNER.length]

// active work — braille dots (cli-spinners "dots", MIT). Distinct motion from
// the sparkle: the sparkle means "needs you", this means "advancing". It spins
// ONLY while an agent truthfully advances; a stalled session freezes on its
// static dot, so motion never lies.
const WORK = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const
export const workFrame = (tick: number): string => WORK[tick % WORK.length]

export const glyph = {
  working: "●",
  idle: "○",
  waiting: "▲",
  ready: "◆",
  unknown: "?",
  error: "✕",
  clock: "", // oct-clock
  check: "", // oct-check
  warn: "", // oct-alert
  gutter: "▎",
  dot: "·",
  expanded: "▾",
  collapsed: "▸",
} as const

export function statusColor(s: AgentStatus): RGBA {
  switch (s) {
    case "waiting":
      return color.attention
    case "error":
      return color.danger
    case "ready":
      return color.positive // the one green in the resting UI: output awaiting your review
    default:
      return color.dim
  }
}

export function statusGlyph(s: AgentStatus): string {
  switch (s) {
    case "working":
      return glyph.working
    case "waiting":
      return glyph.waiting
    case "ready":
      return glyph.ready
    case "unknown":
      return glyph.unknown
    case "error":
      return glyph.error
    default:
      return glyph.idle
  }
}

export function ctxColor(pct: number): RGBA {
  if (pct >= 90) return color.danger
  if (pct >= 70) return color.attention
  return color.dim
}

export function waitColor(sec: number): RGBA {
  if (sec >= 300) return color.danger
  if (sec >= 60) return color.attention
  return color.dim
}

// muted identity hues — distinct from every semantic color, quiet enough to
// never compete with escalation. Applied to 1-cell separators only, never text.
const HUES = ["#7E9CD8", "#957FB8", "#D27E99", "#6A9589", "#C0A36E", "#A292A3"].map(RGBA.fromHex)

/** stable per-project hue — binds an entity's rows across zones and views */
export function projectHue(name: string): RGBA {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function serverMemColor(kb: number): RGBA {
  if (kb > 4 * 1024 * 1024) return color.danger
  if (kb > 1.5 * 1024 * 1024) return color.attention
  return color.dim
}
