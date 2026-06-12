import { memo, type ReactNode } from "react"
import type { Agent } from "../types"
import { color, icon, rail } from "../theme"
import { clip, fmtDuration } from "../format"
import { Stat } from "./Stat"

/**
 * Unfolded detail for a NEEDS-YOU item — the decision context, not the session
 * card. It answers "what do I need to know to respond?": what the session is
 * doing / last did, and its last words — the reasoning behind the ask. The
 * process plumbing (model · tokens · pid · uptime · cwd) lives in Active
 * sessions, not in a decision, so it stays out of here. The task and the ask
 * itself are already on the queue row above, so they aren't repeated.
 */
export const QueueDetail = memo(function QueueDetail({ agent, width }: { agent: Agent; width: number }) {
  const textW = Math.max(20, width - rail.branch.length - 2)
  const rows: ReactNode[] = []

  if (agent.lastTool)
    rows.push(
      <>
        <span fg={color.fg}>{`${icon.pulse} ${agent.status === "working" ? "now   " : "last  "}`}</span>
        <span fg={color.dim}>{clip(agent.lastTool, textW - 18)}</span>
        <span fg={color.faint}> · </span>
        <Stat s={`${fmtDuration(agent.idleSec)} ago`} value={color.dim} unit={color.faint} />
      </>,
    )
  if (agent.lastSaid)
    rows.push(
      <>
        <span fg={color.fg}>{`${icon.comment} said  `}</span>
        <span fg={color.dim}>“{clip(agent.lastSaid, textW - 10)}”</span>
      </>,
    )
  if (rows.length === 0) rows.push(<span fg={color.dim}>{clip(agent.lastActivity, textW)}</span>)

  return (
    <box flexDirection="column">
      {rows.map((r, i) => (
        <text key={i}>
          <span fg={color.faint}>{i === rows.length - 1 ? rail.close : rail.branch}</span>
          {r}
        </text>
      ))}
    </box>
  )
})
