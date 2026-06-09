import { TextAttributes } from "@opentui/core"
import type { Agent } from "../types"
import { color, glyph, statusColor, statusGlyph, ctxColor, waitColor } from "../theme"
import { ctxCells, fmtCost, fmtDuration } from "../format"

/** One agent as a calm 3-line block (matches the spacious single-column design). */
export function AgentBlock({ agent, selected }: { agent: Agent; selected: boolean }) {
  const waiting = agent.status === "waiting"
  const cells = ctxCells(agent.contextPct, 6)
  const indent = "   "

  return (
    <box id={agent.id} flexDirection="column">
      {/* line 1 — identity ............ model / waiting */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={statusColor(agent.status)}>{statusGlyph(agent.status)} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {agent.project}
            {agent.wt ? `/${agent.wt}` : ""}
          </span>
          <span fg={color.dim}>{agent.branch ? ` · ${agent.branch}` : ""}</span>
          {agent.procs > 1 && <span fg={color.dim}>{`  ×${agent.procs}`}</span>}
        </text>
        {waiting ? (
          <text fg={waitColor(agent.idleSec)}>
            {glyph.waiting} {agent.waitKind === "approval" ? "tool pending" : "waiting"} ·{" "}
            {fmtDuration(agent.idleSec)}
          </text>
        ) : (
          <text fg={color.dim}>
            {agent.model}
            {agent.kind === "codex" ? "  ·codex" : ""}
          </text>
        )}
      </box>

      {/* line 2 — activity / question ............ uptime */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={waiting ? color.fg : color.dim}>
          {indent}
          {waiting && agent.question
            ? agent.waitKind === "approval"
              ? agent.question
              : `"${agent.question}"`
            : agent.lastActivity}
        </text>
        {!waiting && (
          <text fg={color.dim}>
            {glyph.clock} {fmtDuration(agent.uptimeSec)}
          </text>
        )}
      </box>

      {/* line 3 — context bar ............ cost */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.dim}>{indent}ctx </span>
          <span fg={ctxColor(agent.contextPct)}>{cells.filled}</span>
          <span fg={color.faint}>{cells.trough}</span>
          <span fg={ctxColor(agent.contextPct)}>  {Math.round(agent.contextPct)}%</span>
          {agent.contextPct >= 90 && <span fg={color.danger}>  near limit</span>}
        </text>
        <text fg={color.fg}>{fmtCost(agent.costUsd)}</text>
      </box>
    </box>
  )
}
