import { color } from "../theme"

const hint = (k: string, label: string) => (
  <span>
    <span fg={color.fg}>{k}</span>
    <span fg={color.dim}> {label}  </span>
  </span>
)

export function Footer({ toast = "", primary = "select" }: { toast?: string; primary?: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        {hint("↑↓", "move")}
        {hint("←→", "fold")}
        {hint("⏎", primary)}
        {hint("x", "kill")}
        {hint("i", "idle")}
        {hint("?", "help")}
        {hint("q", "quit")}
      </text>
      {toast ? <text fg={color.positive}>{toast}</text> : <text> </text>}
    </box>
  )
}
