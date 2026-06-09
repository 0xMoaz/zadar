/** "45s" · "8m" · "1h" · "2h" (compact, single-unit) */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

/** KB → "14G" · "9.8G" · "512M" */
export function fmtMem(kb: number): string {
  if (kb > 1048576) return `${(kb / 1048576).toFixed(1)}G`
  return `${Math.round(kb / 1024)}M`
}

/** tokens → "192k" · "1.2M" */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

export function fmtCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

/** epoch ms → "14:02" */
export const clock = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** replace $HOME prefix with ~ */
export function shorten(path: string, home = process.env.HOME ?? ""): string {
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

/**
 * Context bar cells split for independent coloring. A ghostPct (the
 * pre-compaction high-water mark) renders as faint filled cells between the
 * live fill and the trough — "you were up there a minute ago".
 */
export function ctxCells(
  pct: number,
  cells = 6,
  ghostPct?: number,
): { filled: string; ghost: string; trough: string } {
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  const f = Math.round((clamp(pct) / 100) * cells)
  const g = ghostPct !== undefined ? Math.max(f, Math.round((clamp(ghostPct) / 100) * cells)) : f
  return { filled: "▰".repeat(f), ghost: "▰".repeat(g - f), trough: "▱".repeat(cells - g) }
}

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

/** block-glyph sparkline from a series of values */
export function sparkline(values: number[], width = values.length): string {
  if (values.length === 0) return ""
  const tail = values.slice(-width)
  const max = Math.max(...tail, 1)
  const min = Math.min(...tail, 0)
  const span = max - min || 1
  return tail
    .map((v) => {
      const i = Math.round(((v - min) / span) * (BLOCKS.length - 1))
      return BLOCKS[Math.min(BLOCKS.length - 1, Math.max(0, i))]
    })
    .join("")
}

/** truncate with an ellipsis if longer than max (no padding) */
export function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(0, max - 1)) + "…" : s
}

/** word-wrap into at most maxLines lines of width chars; ellipsized when truncated */
export function wrapText(s: string, width: number, maxLines = 3): string[] {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (candidate.length > width && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else {
      line = candidate
    }
  }
  if (lines.length < maxLines) {
    if (line) lines.push(line)
  } else {
    lines[maxLines - 1] = clip(`${lines[maxLines - 1]} ${line} …`, width)
  }
  return lines.map((l) => clip(l, width))
}

/** pad/truncate to an exact column width (monospace-safe for ASCII-ish content) */
export function col(s: string, width: number, align: "left" | "right" = "left"): string {
  if (s.length > width) return s.slice(0, Math.max(0, width - 1)) + "…"
  return align === "right" ? s.padStart(width) : s.padEnd(width)
}
