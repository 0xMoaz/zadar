import type { Transition } from "../signal"
import { color, statusColor, statusGlyph } from "../theme"
import { clock } from "../format"

/** The flight recorder: every status flip since launch, newest at the bottom. */
export function EventLog({ events, maxRows }: { events: Transition[]; maxRows: number }) {
  const shown = events.slice(-Math.max(3, maxRows))
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={color.accent}
      title="activity"
      titleAlignment="left"
      padding={1}
    >
      {shown.length === 0 ? (
        <text fg={color.dim}>no transitions yet — they'll appear as agents change state</text>
      ) : (
        shown.map((e, i) => (
          <box key={`${e.t}-${e.id}-${i}`} flexDirection="row">
            <box width={8}>
              <text fg={color.dim}>{clock(e.t)}</text>
            </box>
            <box width={24}>
              <text fg={color.fg}>{e.project}</text>
            </box>
            <text>
              {e.from ? <span fg={color.dim}>{`${statusGlyph(e.from)} → `}</span> : null}
              <span fg={statusColor(e.to)}>
                {statusGlyph(e.to)} {e.to}
              </span>
            </text>
          </box>
        ))
      )}
      <box flexGrow={1} />
      <text fg={color.faint}>t / esc close</text>
    </box>
  )
}
