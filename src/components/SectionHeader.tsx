import { TextAttributes } from "@opentui/core"
import { color, glyph } from "../theme"

/** A pillar header: chevron + name left, brief summary right. `pinned` headers are
 *  always open — no chevron, no fold affordance (used for the Needs-you queue). */
export function SectionHeader({
  label,
  summary,
  expanded,
  selected,
  pinned = false,
}: {
  label: string
  summary: string
  expanded: boolean
  selected: boolean
  pinned?: boolean
}) {
  const open = expanded || pinned
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>{pinned ? "  " : `${expanded ? glyph.expanded : glyph.collapsed} `}</span>
        <span fg={open ? color.dim : color.fg} attributes={open ? TextAttributes.NONE : TextAttributes.BOLD}>
          {label}
        </span>
      </text>
      <text fg={color.dim}>{summary}</text>
    </box>
  )
}
