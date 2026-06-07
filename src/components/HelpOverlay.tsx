import { color } from "../theme"

const ROWS: [string, string][] = [
  ["j / k   ↓ / ↑", "move selection"],
  ["g / G", "first / last agent"],
  ["⏎  or  c", "copy `claude --resume <id>` to clipboard"],
  ["x", "kill selected agent (asks to confirm)"],
  ["r", "refresh now"],
  ["?", "toggle this help"],
  ["q  /  esc", "quit"],
]

export function HelpOverlay() {
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={color.accent}
      title="keys"
      titleAlignment="left"
      padding={1}
      gap={1}
    >
      {ROWS.map(([k, label]) => (
        <box key={k} flexDirection="row">
          <box width={16}>
            <text fg={color.fg}>{k}</text>
          </box>
          <text fg={color.dim}>{label}</text>
        </box>
      ))}
      <box paddingTop={1}>
        <text fg={color.faint}>fleet · terminal mission control for parallel agents</text>
      </box>
    </box>
  )
}
