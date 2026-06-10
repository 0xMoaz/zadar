import { TextAttributes } from "@opentui/core"
import type { AttentionItem } from "../fleetmap"
import { color, glyph, projectHue, waitColor } from "../theme"
import { clip, fmtDuration, wrapText } from "../format"
import type { RGBA } from "@opentui/core"

const CHIP_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"]
const INDENT = "     "

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
 * One actionable item in the NEEDS YOU queue. Agent items anchor on the TASK
 * (what you asked that session to do — the context you need to decide whether
 * to switch), then state the ask / failure / review beneath. Server items
 * stay one calm line.
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
  const agent = item.agent
  const textW = Math.max(20, width - INDENT.length - 2)

  // server items: everything fits one line
  if (!agent) {
    return (
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={c}>{g} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {item.project}
          </span>
          <span fg={projectHue(item.project.split("/")[0])}>{" · "}</span>
          <span fg={color.dim}>{clip(item.title, textW - item.project.length)}</span>
        </text>
        {item.ageSec > 0 && <text fg={c}>{fmtDuration(item.ageSec)}</text>}
      </box>
    )
  }

  const taskW = Math.max(12, width - item.project.length - 14)
  const bodyLines =
    item.kind === "question" ? wrapText(item.title, textW, 2) : [clip(item.title, textW)]

  return (
    <box flexDirection="column">
      {/* who — on what task ............ for how long */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={c}>{g} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {item.project}
          </span>
          {agent.task && (
            <span>
              <span fg={projectHue(item.project.split("/")[0])}>{" · "}</span>
              <span fg={color.dim}>{clip(agent.task, taskW)}</span>
            </span>
          )}
        </text>
        {item.ageSec > 0 && <text fg={c}>{fmtDuration(item.ageSec)}</text>}
      </box>

      {/* the ask / failure / review */}
      {item.kind === "ready" && agent.diff && agent.diff.files > 0 ? (
        <text>
          <span fg={color.dim}>{INDENT}review </span>
          <span fg={color.positive}>+{agent.diff.plus}</span>
          <span fg={color.danger}> −{agent.diff.minus}</span>
          <span fg={color.dim}>
            {" "}
            across {agent.diff.files} {agent.diff.files === 1 ? "file" : "files"}
          </span>
        </text>
      ) : (
        bodyLines.map((l, i) => (
          <text key={i} fg={item.kind === "question" ? color.fg : color.dim}>
            {INDENT}
            {l}
          </text>
        ))
      )}
      {item.kind === "question" && agent.options && agent.options.length > 0 && (
        <text>
          <span fg={color.dim}>{INDENT}</span>
          {agent.options.slice(0, CHIP_NUMS.length).map((o, i) => (
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
