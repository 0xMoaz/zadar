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
 *
 * Decoration carries signal: the working glyph brightens only when the
 * transcript actually advanced this poll (truthful pulse); idle rows fade
 * with age (typographic decay); a ready row's badge is its diff (+/-);
 * a faint ghost on the ctx bar marks a fresh compaction's high-water mark.
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
  const idle = agent.status === "idle"
  const cells = ctxCells(agent.contextPct, 6, agent.ctxGhostPct)
  const narrow = width < 70
  const textW = Math.max(20, width - INDENT.length - 2)

  // truthful pulse: bright only if the transcript advanced within ~one poll
  const pulse = agent.status === "working" && agent.idleSec <= 3
  const glyphColor = pulse ? color.fg : statusColor(agent.status)
  // typographic decay: idle rows fade with age
  const nameColor = idle ? (agent.idleSec > 40 * 60 ? color.faint : color.dim) : color.fg

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

  const showDiff = agent.status === "ready" && agent.diff && agent.diff.files > 0

  return (
    <box flexDirection="column">
      {/* the row — identity ............ vitals */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={glyphColor}>{statusGlyph(agent.status)} </span>
          <span fg={nameColor} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {name}
          </span>
          {!narrow && <span fg={idle ? color.faint : color.dim}>{agent.branch ? ` · ${agent.branch}` : ""}</span>}
          {agent.procs > 1 && <span fg={color.dim}>{`  ×${agent.procs}`}</span>}
          {agent.kind === "codex" && <span fg={color.faint}>{"  ·codex"}</span>}
        </text>
        {urgent ? (
          <text fg={urgentColor}>{urgentLabel}</text>
        ) : showDiff ? (
          <text>
            <span fg={color.positive}>+{agent.diff!.plus}</span>
            <span fg={color.danger}> −{agent.diff!.minus}</span>
            <span fg={color.dim}>
              {"  "}
              {agent.diff!.files} {agent.diff!.files === 1 ? "file" : "files"}
            </span>
          </text>
        ) : (
          <text>
            {!narrow && (
              <span>
                <span fg={ctxColor(agent.contextPct)}>{cells.filled}</span>
                <span fg={color.faint}>{cells.ghost}</span>
                <span fg={color.faint}>{cells.trough}</span>
              </span>
            )}
            <span fg={ctxColor(agent.contextPct)}> {String(Math.round(agent.contextPct)).padStart(3)}%</span>
            {agent.ctxGhostPct !== undefined && <span fg={color.dim}>⟳</span>}
            <span fg={idle ? color.dim : color.fg}>  {fmtCost(agent.costUsd)}</span>
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
            {agent.burnPerHour !== undefined && agent.burnPerHour >= 0.05 && (
              <span fg={color.dim}> · ${agent.burnPerHour.toFixed(1)}/h</span>
            )}
            {urgent && (
              <span fg={ctxColor(agent.contextPct)}>
                {"  ctx "}
                {Math.round(agent.contextPct)}%
              </span>
            )}
            {urgent && <span fg={color.fg}>{"  "}{fmtCost(agent.costUsd)}</span>}
          </text>
          {agent.diff && agent.diff.files > 0 && !showDiff && (
            <text>
              <span fg={color.dim}>{INDENT}uncommitted </span>
              <span fg={color.positive}>+{agent.diff.plus}</span>
              <span fg={color.danger}> −{agent.diff.minus}</span>
              <span fg={color.dim}>
                {" "}
                across {agent.diff.files} {agent.diff.files === 1 ? "file" : "files"}
              </span>
            </text>
          )}
          <text fg={color.faint}>
            {INDENT}
            {shorten(agent.cwd)}
          </text>
        </box>
      )}
    </box>
  )
}
