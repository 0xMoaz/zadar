import { color } from "../theme"
import { clip } from "../format"
import { Keycap } from "./Keycap"

export type Hint = [key: string, label: string]

const wOf = ([k, label]: Hint) => k.length + 2 + 1 + label.length + 2

function Chips({ hints }: { hints: Hint[] }) {
  return (
    <text>
      {hints.map(([k, label], i) => (
        <span key={k + label}>
          {i > 0 ? <span>{"  "}</span> : null}
          <Keycap k={k} />
          <span fg={color.dim}> {label}</span>
        </span>
      ))}
    </text>
  )
}

/**
 * Two-sided footer: what you can do to the selection on the LEFT, the system
 * keys (view / help — or back, inside an overlay) tucked on the RIGHT.
 * A toast borrows the left side while it lives. One line, never wraps.
 */
export function Footer({
  left,
  right,
  toast = "",
  width,
}: {
  left: Hint[]
  right: Hint[]
  toast?: string
  width: number
}) {
  const rightW = right.reduce((n, h) => n + wOf(h), 0)
  const budget = width - rightW - 2
  const shown: Hint[] = []
  let used = 0
  if (!toast)
    for (const h of left) {
      if (used + wOf(h) > budget) break
      shown.push(h)
      used += wOf(h)
    }
  return (
    <box flexDirection="row" justifyContent="space-between" height={1}>
      {toast ? <text fg={color.positive}>{clip(toast, Math.max(8, budget))}</text> : <Chips hints={shown} />}
      <Chips hints={right} />
    </box>
  )
}
