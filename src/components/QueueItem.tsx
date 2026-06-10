import { TextAttributes } from "@opentui/core"
import type { AttentionItem } from "../fleetmap"
import { color, glyph, projectHue, waitColor } from "../theme"
import { fmtDuration, wrapText } from "../format"
import type { RGBA } from "@opentui/core"

const CHIP_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"]

function kindGlyph(item: AttentionItem): { g: string; c: RGBA } {
  switch (item.kind) {
    case "question":
    case "approval":
      return { g: glyph.waiting, c: waitColor(item.ageSec) }
    case "error":
      return { g: glyph.error, c: color.danger }
    case "ready":
      return { g: glyph.ready, c: color.positive }
    case "server-mem":
      return { g: glyph.warn, c: color.danger }
    case "ctx-high":
    case "server-stale":
      return { g: glyph.warn, c: color.attention }
  }
}

/** The strip variant: one fixed line, no chips — urgency as presence. */
export function QueueStripLine({ item, width }: { item: AttentionItem; width: number }) {
  const { g, c } = kindGlyph(item)
  const title = wrapText(item.title, Math.max(16, width - item.project.length - 12), 1)[0] ?? ""
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={c}>{` ${g} `}</span>
        <span fg={color.fg}>{item.project}</span>
        <span fg={projectHue(item.project.split("/")[0])}>{" · "}</span>
        <span fg={item.kind === "question" ? color.fg : color.dim}>{title}</span>
      </text>
      {item.ageSec > 0 && <text fg={c}>{fmtDuration(item.ageSec)}</text>}
    </box>
  )
}

/**
 * One actionable item in the NEEDS YOU queue: who — what — for how long.
 * The title is an action sentence; questions bring their option chips along.
 */
export function QueueItem({
  item,
  selected,
  width,
}: {
  item: AttentionItem
  selected: boolean
  width: number
}) {
  const { g, c } = kindGlyph(item)
  const textW = Math.max(20, width - item.project.length - 14)
  const titleLines =
    item.kind === "question" ? wrapText(item.title, textW, 2) : wrapText(item.title, textW, 1)

  return (
    <box flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={c}>{g} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {item.project}
          </span>
          <span fg={projectHue(item.project.split("/")[0])}>{" · "}</span>
          <span fg={item.kind === "question" ? color.fg : color.dim}>{titleLines[0] ?? ""}</span>
        </text>
        {item.ageSec > 0 && <text fg={c}>{fmtDuration(item.ageSec)}</text>}
      </box>
      {titleLines.slice(1).map((l, i) => (
        <text key={i} fg={color.fg}>
          {"     "}
          {l}
        </text>
      ))}
      {item.kind === "question" && item.agent?.options && item.agent.options.length > 0 && (
        <text>
          <span fg={color.dim}>{"     "}</span>
          {item.agent.options.slice(0, CHIP_NUMS.length).map((o, i) => (
            <span key={o}>
              <span fg={color.accent}>{CHIP_NUMS[i]} </span>
              <span fg={color.dim}>{o}   </span>
            </span>
          ))}
        </text>
      )}
    </box>
  )
}
