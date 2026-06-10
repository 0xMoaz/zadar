import type { RGBA } from "@opentui/core"
import { color } from "../theme"

/**
 * Stat typography: the value pops, everything else recedes — digits take the
 * value color; units, symbols, labels, AND decimal fractions take the unit
 * color. "1h27m" → 1·27 bright, h·m grey. "$54.83" → 54 bright, $·.83 grey.
 */
export function statSegs(s: string): { t: string; v: boolean }[] {
  const out: { t: string; v: boolean }[] = []
  const re = /(\d+)(\.\d+)?|(\D+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m[3] !== undefined) out.push({ t: m[3], v: false })
    else {
      out.push({ t: m[1], v: true })
      if (m[2]) out.push({ t: m[2], v: false })
    }
  }
  return out
}

export function Stat({ s, value = color.fg, unit = color.dim }: { s: string; value?: RGBA; unit?: RGBA }) {
  return (
    <span>
      {statSegs(s).map((seg, i) => (
        <span key={i} fg={seg.v ? value : unit}>
          {seg.t}
        </span>
      ))}
    </span>
  )
}
