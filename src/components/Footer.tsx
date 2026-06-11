import { color } from "../theme"
import { clip } from "../format"

export type Hint = [key: string, label: string, icon?: string]

/**
 * Context-sensitive hints. When a hint has an icon, the icon IS the key's
 * visual (one symbol per action — keys are documented in ? help); otherwise
 * the key shows. Hints that don't fit are dropped, never wrapped: the footer
 * is one line, always.
 */
export function Footer({ hints, toast = "", width }: { hints: Hint[]; toast?: string; width: number }) {
  const wOf = ([k, label, ic]: Hint) => (ic ? 2 : k.length + 1) + label.length + 2
  const budget = width - (toast ? Math.min(toast.length, 24) + 2 : 0)
  const shown: Hint[] = []
  let used = 0
  for (const h of hints) {
    if (used + wOf(h) > budget) break
    shown.push(h)
    used += wOf(h)
  }
  const toastShown = toast ? clip(toast, Math.max(8, width - used - 2)) : ""
  return (
    <box flexDirection="row" justifyContent="space-between" height={1}>
      <text>
        {shown.map(([k, label, ic]) => (
          <span key={k + label}>
            {ic ? <span fg={color.fg}>{ic}</span> : <span fg={color.fg}>{k}</span>}
            <span fg={color.dim}> {label}  </span>
          </span>
        ))}
      </text>
      {toastShown ? <text fg={color.positive}>{toastShown}</text> : <text> </text>}
    </box>
  )
}
