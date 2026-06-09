import { TextAttributes } from "@opentui/core"
import type { ProjectGroup } from "../fleetmap"
import type { AgentStatus } from "../types"
import { color, glyph, statusColor, statusGlyph } from "../theme"
import { fmtCost, fmtMem } from "../format"

const STATUS_ORDER: AgentStatus[] = ["waiting", "error", "ready", "working", "unknown", "idle"]

/**
 * One project as a single entity: worst-case glyph, what it's made of
 * (agents by state · server ports · trees), and what it costs.
 */
export function ProjectCard({
  group,
  selected,
  expanded,
  width,
}: {
  group: ProjectGroup
  selected: boolean
  expanded: boolean
  width: number
}) {
  const narrow = width < 70
  const counts = new Map<AgentStatus, number>()
  for (const a of group.agents) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
  const server = group.servers[0]
  const moreServers = group.servers.length - 1
  const wt = group.worktrees

  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>{expanded ? glyph.expanded : glyph.collapsed} </span>
        <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
          {group.key}
        </span>
        <span fg={color.dim}>{"   "}</span>
        {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
          <span key={s}>
            <span fg={statusColor(s)}>{statusGlyph(s)}</span>
            <span fg={color.dim}>{counts.get(s)}{" "}</span>
          </span>
        ))}
        {server && (
          <span>
            <span fg={color.dim}>{`${counts.size ? "· " : ""}:${server.port} `}</span>
            <span fg={server.memKB > 4 * 1024 * 1024 ? color.danger : color.dim}>
              {fmtMem(server.memKB)}
              {server.memKB > 4 * 1024 * 1024 ? glyph.warn : ""}
            </span>
            {moreServers > 0 && <span fg={color.dim}>{` +${moreServers}`}</span>}
            {server.stale && <span fg={color.attention}> stale</span>}
          </span>
        )}
        {wt && !narrow && (
          <span fg={color.dim}>
            {`${counts.size || server ? " · " : ""}${wt.total} ${wt.total === 1 ? "tree" : "trees"}`}
            {wt.changed > 0 ? <span fg={color.attention}>{` ${wt.changed} dirty`}</span> : null}
          </span>
        )}
      </text>
      <text>
        {group.cost > 0 && <span fg={color.fg}>{fmtCost(group.cost)}</span>}
        {group.burn >= 0.05 && <span fg={color.dim}> · ${group.burn.toFixed(1)}/h</span>}
      </text>
    </box>
  )
}
