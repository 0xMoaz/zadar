import { TextAttributes } from "@opentui/core"
import { color, glyph } from "../theme"

/** A collapsible pillar header: chevron + icon + name left, brief summary right. */
export function SectionHeader({
  label,
  summary,
  expanded,
  selected,
  icon,
  iconColor,
}: {
  label: string
  summary: string
  expanded: boolean
  selected: boolean
  icon?: string
  iconColor?: typeof color.dim
}) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>
          {expanded ? glyph.expanded : glyph.collapsed}{" "}
        </span>
        {icon ? <span fg={iconColor ?? color.dim}>{icon} </span> : null}
        <span
          fg={selected ? color.dim : color.fg}
          attributes={selected ? TextAttributes.NONE : TextAttributes.BOLD}
        >
          {label}
        </span>
      </text>
      <text fg={color.dim}>{summary}</text>
    </box>
  )
}
