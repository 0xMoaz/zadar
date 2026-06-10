import { color } from "../theme"

/** Context-sensitive keybinding hints; only keys that do something right now. */
export function Footer({ hints, toast = "" }: { hints: [string, string][]; toast?: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        {hints.map(([k, label]) => (
          <span key={k}>
            <span fg={color.fg}>{k}</span>
            <span fg={color.dim}> {label}  </span>
          </span>
        ))}
      </text>
      {toast ? <text fg={color.positive}>{toast}</text> : <text> </text>}
    </box>
  )
}
