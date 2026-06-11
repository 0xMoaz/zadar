import type { RGBA } from "@opentui/core"
import type { AgentStatus } from "../types"
import { color, statusGlyph } from "../theme"

type Entry = { status: AgentStatus; label: string; tone: () => RGBA }

// Grouped on zadar's axis, urgency first: needs you (attention owed) │ ambient (the
// agent has it). tone is a thunk so palette overrides (applyTerminalPalette) read at render.
const GROUPS: Entry[][] = [
  [
    { status: "waiting", label: "waiting", tone: () => color.attention },
    { status: "ready", label: "review", tone: () => color.positive },
    { status: "error", label: "error", tone: () => color.danger },
  ],
  [
    { status: "working", label: "working", tone: () => color.fg },
    { status: "idle", label: "idle", tone: () => color.dim },
  ],
]

/**
 * The state legend: spells out what each status glyph means — the vocabulary the
 * header pills (▲2 ✕1 ◆1 ●2) assume you already know. It lights up: a state present
 * in the fleet shows in its color, an empty one fades to faint, so it doubles as an
 * ambient mirror of what's live without repeating the header's counts.
 */
export function StateLegend({ present }: { present: Set<AgentStatus> }) {
  return (
    <text>
      {GROUPS.map((group, gi) => (
        <span key={gi}>
          {gi > 0 && <span fg={color.faint}>{"   │   "}</span>}
          {group.map((e, ei) => (
            <span key={e.status} fg={present.has(e.status) ? e.tone() : color.faint}>
              {ei > 0 ? "   " : ""}
              {statusGlyph(e.status)} {e.label}
            </span>
          ))}
        </span>
      ))}
    </text>
  )
}
