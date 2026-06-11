import { TextAttributes } from "@opentui/core"
import { color, glyph } from "../theme"

/** A collapsible pillar header: chevron + name left, brief summary right. */
export function SectionHeader({
  label,
  summary,
  expanded,
  selected,
}: {
  label: string
  summary: string
  expanded: boolean
  selected: boolean
}) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>
          {expanded ? glyph.expanded : glyph.collapsed}{" "}
        </span>
        <span
          fg={expanded ? color.dim : color.fg}
          attributes={expanded ? TextAttributes.NONE : TextAttributes.BOLD}
        >
          {label}
        </span>
      </text>
      <text fg={color.dim}>{summary}</text>
    </box>
  )
}
