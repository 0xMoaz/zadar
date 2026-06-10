import { color } from "../theme"
import { clip } from "../format"

/** Context-sensitive keybinding hints; the toast clips rather than wraps. */
export function Footer({ hints, toast = "", width }: { hints: [string, string][]; toast?: string; width: number }) {
  const used = hints.reduce((n, [k, label]) => n + k.length + label.length + 3, 0)
  const shown = toast ? clip(toast, Math.max(8, width - used - 2)) : ""
  return (
    <box flexDirection="row" justifyContent="space-between" height={1}>
      <text>
        {hints.map(([k, label]) => (
          <span key={k}>
            <span fg={color.fg}>{k}</span>
            <span fg={color.dim}> {label}  </span>
          </span>
        ))}
      </text>
      {shown ? <text fg={color.positive}>{shown}</text> : <text> </text>}
    </box>
  )
}
