/** Per-1M-token USD prices. Mirrors ~/.claude/readout-pricing.json tiers; edit to taste. */
export interface Price {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

const TABLE: Record<string, Price> = {
  opus: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  haiku: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // gpt-5.x family (Codex) — approximate; keep current manually.
  gpt: { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
}

export function priceFor(model: string): Price {
  const m = model.toLowerCase()
  if (m.includes("opus")) return TABLE.opus
  if (m.includes("sonnet")) return TABLE.sonnet
  if (m.includes("haiku")) return TABLE.haiku
  if (m.includes("gpt") || m.includes("codex") || m.includes("o1") || m.includes("o3")) return TABLE.gpt
  return TABLE.sonnet
}

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export function costOf(u: Usage, model: string): number {
  const p = priceFor(model)
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6
}
