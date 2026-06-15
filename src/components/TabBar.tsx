import { TextAttributes } from "@opentui/core"
import { color } from "../theme"

/**
 * The compact tier's band switcher: section tabs pinned to the bottom, the active
 * one painted as a pill. Tab cycles; a click jumps straight to a band.
 */
export function TabBar({
  tabs,
  active,
  onTab,
}: {
  tabs: { key: string; label: string }[]
  active: string
  onTab: (key: string) => void
}) {
  return (
    <box flexDirection="row" height={1}>
      {tabs.map((t, i) => (
        <box key={t.key} onMouseDown={(e: { button: number }) => e.button === 0 && onTab(t.key)}>
          <text>
            {i > 0 ? <span fg={color.faint}>{" "}</span> : null}
            {t.key === active ? (
              <span fg={color.accent} bg={color.pill} attributes={TextAttributes.BOLD}>{` ${t.label} `}</span>
            ) : (
              <span fg={color.dim}>{` ${t.label} `}</span>
            )}
          </text>
        </box>
      ))}
    </box>
  )
}
