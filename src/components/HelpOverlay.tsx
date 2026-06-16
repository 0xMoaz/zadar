import { color } from "../theme"
import { upgradeHint } from "../update"

const ROWS: [string, string][] = [
  ["j / k   ↓ / ↑", "move selection"],
  ["g / G", "first / last row"],
  ["⏎  or click", "go there (queue item / server) · else expand / collapse details"],
  ["␣", "unfold / fold details (or fold a section)"],
  ["← / →   h / l", "fold section · unfold / fold details"],
  ["⇥  Tab", "switch band — compact / HUD view"],
  ["o", "open — the session's app or terminal (agent) / browser (server)"],
  ["c", "copy resume command (agent) / url (server)"],
  ["x", "kill agent or server (asks to confirm)"],
  ["p", "prune a clean worktree (asks to confirm)"],
  ["t", "activity log — every status flip this session"],
  ["n", "toggle desktop notifications (on by default)"],
  ["r", "refresh now"],
  ["?", "toggle this help"],
  ["q", "quit"],
]

export function HelpOverlay({
  version,
  updateVer,
  pending,
  autoUpdates,
}: {
  version: string
  updateVer?: string | null
  /** a newer release already pulled in the background — restart to run it */
  pending?: string | null
  /** this copy updates itself (binary / global install) vs. a manual upgrade */
  autoUpdates?: boolean
}) {
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
        <text fg={color.faint}>zadar v{version} · terminal mission control for parallel agents</text>
        {pending ? (
          <text>
            <span fg={color.positive}>↑ v{pending} downloaded</span>
            <span fg={color.dim}>{"  ·  restart zadar to apply"}</span>
          </text>
        ) : updateVer ? (
          <text>
            <span fg={color.positive}>↑ v{updateVer} available</span>
            <span fg={color.dim}>{`  ·  ${autoUpdates ? "updating automatically…" : upgradeHint()}`}</span>
          </text>
        ) : null}
      </box>
    </box>
  )
}
