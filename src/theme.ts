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

export const glyph = {
  working: "●",
  idle: "○",
  waiting: "▲",
  error: "✕",
  clock: "◷",
  check: "✓",
  warn: "⚠",
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

export function serverMemColor(kb: number): RGBA {
  if (kb > 4 * 1024 * 1024) return color.danger
  if (kb > 1.5 * 1024 * 1024) return color.attention
  return color.dim
}
