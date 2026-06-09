import { TextAttributes } from "@opentui/core"
import type { Agent } from "../types"
import { color, glyph, statusColor, statusGlyph, ctxColor, waitColor } from "../theme"
import { ctxCells, fmtCost, fmtDuration, fmtTokens, shorten, wrapText } from "../format"

const CHIP_NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"]
const INDENT = "     " // aligns content under the row name (gutter + glyph + space)

/**
 * One agent, progressively disclosed:
 *  - at rest: ONE calm line — identity left, vitals (ctx · cost) right
 *  - urgency auto-expands: waiting/error rows reveal the literal question /
 *    pending tool / failure beneath (urgency = height, no keystroke needed)
 *  - Enter discloses detail: recent activity, tokens · model · uptime, cwd
 */
export function AgentBlock({
  agent,
  selected,
  expanded,
  width,
}: {
  agent: Agent
  selected: boolean
  expanded: boolean
  width: number
}) {
  const waiting = agent.status === "waiting"
  const errored = agent.status === "error"
  const cells = ctxCells(agent.contextPct, 6)
  const narrow = width < 70
  const textW = Math.max(20, width - INDENT.length - 2)

  const name = agent.wt ? `${agent.project}/${agent.wt}` : agent.project
  const urgent = waiting || errored
  const urgentColor = errored ? color.danger : waitColor(agent.idleSec)
  const urgentLabel = errored
    ? `${glyph.error} ${fmtDuration(agent.idleSec)}`
    : `${glyph.waiting} ${agent.waitKind === "approval" ? "pending" : "waiting"} · ${fmtDuration(agent.idleSec)}`

  const questionLines =
    waiting && agent.waitKind === "question" && agent.question
      ? wrapText(`"${agent.question}"`, textW, 3)
      : []
  const noteLine = urgent && agent.waitKind !== "question" ? agent.question : undefined

  return (
    <box flexDirection="column">
      {/* the row — identity ............ vitals */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={statusColor(agent.status)}>{statusGlyph(agent.status)} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {name}
          </span>
          {!narrow && <span fg={color.dim}>{agent.branch ? ` · ${agent.branch}` : ""}</span>}
          {agent.procs > 1 && <span fg={color.dim}>{`  ×${agent.procs}`}</span>}
          {agent.kind === "codex" && <span fg={color.faint}>{"  ·codex"}</span>}
        </text>
        {urgent ? (
          <text fg={urgentColor}>{urgentLabel}</text>
        ) : (
          <text>
            {!narrow && (
              <span>
                <span fg={ctxColor(agent.contextPct)}>{cells.filled}</span>
                <span fg={color.faint}>{cells.trough}</span>
              </span>
            )}
            <span fg={ctxColor(agent.contextPct)}> {String(Math.round(agent.contextPct)).padStart(3)}%</span>
            <span fg={agent.status === "idle" ? color.dim : color.fg}>  {fmtCost(agent.costUsd)}</span>
          </text>
        )}
      </box>

      {/* auto-expanded urgency — the literal question / pending tool / failure */}
      {questionLines.map((l, i) => (
        <text key={`q${i}`} fg={color.fg}>
          {INDENT}
          {l}
        </text>
      ))}
      {waiting && agent.options && agent.options.length > 0 && (
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
      {noteLine && (
        <text fg={color.dim}>
          {INDENT}
          {noteLine}
        </text>
      )}

      {/* disclosed detail — recent activity + vitals + place */}
      {expanded && (
        <box flexDirection="column">
          {agent.recent.map((r, i) => (
            <text key={`r${i}`} fg={color.dim}>
              {INDENT}
              {r}
            </text>
          ))}
          <text>
            <span fg={color.dim}>{INDENT}</span>
            <span fg={color.dim}>
              {agent.model} · {fmtTokens(agent.tokens)} tok · {glyph.clock} {fmtDuration(agent.uptimeSec)} · pid{" "}
              {agent.pid}
            </span>
            {urgent && (
              <span fg={ctxColor(agent.contextPct)}>
                {"  ctx "}
                {Math.round(agent.contextPct)}%
              </span>
            )}
            {urgent && <span fg={color.fg}>{"  "}{fmtCost(agent.costUsd)}</span>}
          </text>
          <text fg={color.faint}>
            {INDENT}
            {shorten(agent.cwd)}
          </text>
        </box>
      )}
    </box>
  )
}
