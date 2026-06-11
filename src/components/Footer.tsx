import { color } from "../theme"
import { clip } from "../format"

export type Hint = [key: string, label: string]

/** a-z → ⓐ-ⓩ keycaps — the same circled family as the ①② option chips */
const keycap = (k: string): string =>
  k.length === 1 && k >= "a" && k <= "z" ? String.fromCharCode(0x24d0 + k.charCodeAt(0) - 97) : k

/**
 * Context-sensitive hints: keycap + word. Hints that don't fit are dropped,
 * never wrapped — the footer is one line, always.
 */
export function Footer({ hints, toast = "", width }: { hints: Hint[]; toast?: string; width: number }) {
  const wOf = ([k, label]: Hint) => keycap(k).length + 1 + label.length + 2
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
        {shown.map(([k, label]) => (
          <span key={k + label}>
            <span fg={color.fg}>{keycap(k)}</span>
            <span fg={color.dim}> {label}  </span>
          </span>
        ))}
      </text>
      {toastShown ? <text fg={color.positive}>{toastShown}</text> : <text> </text>}
    </box>
  )
}
