import { color } from "../theme"
import { clip } from "../format"

export type Hint = [key: string, label: string, icon?: string]

/** Context-sensitive keybinding hints; the toast clips rather than wraps. */
export function Footer({ hints, toast = "", width }: { hints: Hint[]; toast?: string; width: number }) {
  const used = hints.reduce((n, [k, label, ic]) => n + k.length + label.length + (ic ? 2 : 0) + 3, 0)
  const shown = toast ? clip(toast, Math.max(8, width - used - 2)) : ""
  return (
    <box flexDirection="row" justifyContent="space-between" height={1}>
      <text>
        {hints.map(([k, label, ic]) => (
          <span key={k}>
            <span fg={color.fg}>{k}</span>
            {ic ? <span fg={color.faint}> {ic}</span> : null}
            <span fg={color.dim}> {label}  </span>
          </span>
        ))}
      </text>
      {shown ? <text fg={color.positive}>{shown}</text> : <text> </text>}
    </box>
  )
}
