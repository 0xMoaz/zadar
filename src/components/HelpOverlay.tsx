import { color } from "../theme"

const ROWS: [string, string][] = [
  ["j / k   ↓ / ↑", "move selection"],
  ["g / G", "first / last row"],
  ["⏎", "expand / collapse details (or fold a section)"],
  ["v", "switch view — home (sessions first) / queue map"],
  ["← / →   h / l", "fold section · close / open details"],
  ["o", "open — Claude app (agent) / browser (server)"],
  ["c", "copy resume command (agent) / url (server)"],
  ["x", "kill agent or server (asks to confirm)"],
  ["p", "prune a clean worktree (asks to confirm)"],
  ["t", "activity log — every status flip this session"],
  ["n", "toggle desktop notifications (on by default)"],
  ["i", "show / hide idle sessions"],
  ["r", "refresh now"],
  ["?", "toggle this help"],
  ["q", "quit"],
]

export function HelpOverlay({ version, updateVer }: { version: string; updateVer?: string | null }) {
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
      <box paddingTop={1} flexDirection="column">
        <text fg={color.faint}>fleet v{version} · terminal mission control for parallel agents</text>
        {updateVer ? (
          <text>
            <span fg={color.positive}>↑ v{updateVer} available</span>
            <span fg={color.dim}>{"  ·  bunx zefleet@latest  ·  brew upgrade"}</span>
          </text>
        ) : null}
      </box>
    </box>
  )
}
