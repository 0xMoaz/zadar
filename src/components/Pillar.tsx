import type { ReactNode } from "react"
import { color } from "../theme"
import { SectionHeader } from "./SectionHeader"

/**
 * A collapsible pillar: header on top, and — when expanded — its content
 * indented under a faint left guide line that doubles as the open/close separator.
 */
export function Pillar({
  id,
  label,
  summary,
  expanded,
  selected,
  dense = false,
  pinned = false,
  onHeaderMouseDown,
  children,
}: {
  id: string
  label: string
  summary: string
  expanded: boolean
  selected: boolean
  dense?: boolean
  pinned?: boolean
  onHeaderMouseDown?: (e: { button: number }) => void
  children?: ReactNode
}) {
  return (
    <box flexDirection="column">
      <box id={id} onMouseDown={onHeaderMouseDown}>
        <SectionHeader
          label={label}
          summary={summary}
          expanded={expanded}
          selected={selected}
          pinned={pinned}
        />
      </box>
      {(expanded || pinned) && children ? (
        <box paddingTop={dense ? 0 : 1} paddingLeft={1}>
          <box
            border={["left"]}
            borderStyle="single"
            borderColor={color.faint}
            paddingLeft={2}
            flexDirection="column"
            gap={dense ? 0 : 1}
          >
            {children}
          </box>
        </box>
      ) : null}
    </box>
  )
}
