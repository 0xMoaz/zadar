// Exact zadar design tokens, ported from src/theme.ts + src/format.ts of the app —
// so this web replica is pixel-faithful to the real terminal.

// GitHub Dark, in OKLCH. ANSI accent colors (blue/yellow/red/green) over a
// near-pitch-black, faintly blue-themed background. Neutrals share hue ~253 —
// GitHub's blue-tinted grays. (accent uses GitHub blue; the theme's ANSI cyan
// is too dark for a wordmark.)
export const C = {
  fg: "oklch(0.857 0.014 248)", // GitHub default text
  dim: "oklch(0.662 0.018 250.9)", // muted
  faint: "oklch(0.425 0.017 254.7)", // subtle / decay
  pill: "oklch(0.267 0.015 256.8)", // keycap surface
  accent: "oklch(0.716 0.137 258.3)", // GitHub blue
  attention: "oklch(0.79 0.139 85.2)", // yellow — waiting
  danger: "oklch(0.73 0.15 34.1)", // red — error / mem
  positive: "oklch(0.772 0.188 145.5)", // green — review
  panel: "oklch(0.135 0.008 255)", // near-pitch-black terminal bg
  line: "oklch(0.33 0.015 252.3)", // border
} as const

export const G = {
  working: "●",
  idle: "○",
  waiting: "▲",
  ready: "◆",
  error: "✕",
  check: "✓", // app uses a Nerd-Font check; ✓ renders everywhere
  branch: "", // U+F418 git-branch — in zadar-symbols.woff2
  ghost: "⟳",
  gutter: "▎",
} as const

export const WORK = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
export const SPARKLE = ["✻", "✽", "✻", "✶", "✳", "✢", "·", "✢", "✳", "✶"]
export const CTX_FILL = "▰"
export const CTX_TROUGH = "▱"

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
/** block-glyph sparkline (EKG) — exact port of format.sparkline */
export function sparkline(values: number[]): string {
  if (values.length === 0) return ""
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  return values
    .map((v) => {
      const i = Math.round(((v - min) / span) * (BLOCKS.length - 1))
      return BLOCKS[Math.min(BLOCKS.length - 1, Math.max(0, i))]
    })
    .join("")
}

/** 6-cell context bar: filled (ctx color) + trough (faint) */
export function ctxBar(pct: number): { filled: string; trough: string } {
  const f = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 6)
  return { filled: CTX_FILL.repeat(f), trough: CTX_TROUGH.repeat(6 - f) }
}

export const ctxColor = (pct: number) => (pct >= 90 ? C.danger : pct >= 70 ? C.attention : C.dim)
export const waitColor = (sec: number) => (sec >= 300 ? C.danger : sec >= 60 ? C.attention : C.dim)

const HUES = [
  "oklch(0.769 0.121 252.3)",
  "oklch(0.727 0.137 299.1)",
  "oklch(0.662 0.168 349.5)",
  "oklch(0.755 0.116 202.1)",
  "oklch(0.811 0.124 55.1)",
  "oklch(0.851 0.141 150.3)",
]
/** stable per-project hue — exact port of theme.projectHue */
export function projectHue(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}
