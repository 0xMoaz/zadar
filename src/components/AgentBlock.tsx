import { TextAttributes } from "@opentui/core"
import type { Agent } from "../types"
import { color, glyph, icon, projectHue, statusColor, statusGlyph, ctxColor, waitColor } from "../theme"
import { clip, ctxCells, fmtCost, fmtDuration, fmtTokens, shorten, sparkline, wrapText } from "../format"
import { Stat } from "./Stat"

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
  const urgentWord = errored ? glyph.error : `${glyph.waiting} ${agent.waitKind === "approval" ? "pending" : "waiting"} ·`

  const questionLines =
    waiting && agent.waitKind === "question" && agent.question
      ? wrapText(`“${agent.question}”`, textW, 3)
      : []
  const noteLine = urgent && agent.waitKind !== "question" ? agent.question : undefined

  const showDiff = agent.status === "ready" && agent.diff && agent.diff.files > 0
  // the vitals grid: every slot has a fixed width so columns never drift —
  // EKG (12 + gutter, wide only) · bar (6) · pct (4) · ghost (1) · cost (7)
  const ekgSlot =
    width >= 90
      ? (agent.status === "working" && agent.rhythm ? sparkline(agent.rhythm).padStart(12) : " ".repeat(12)) + "  "
      : ""

  return (
    <box flexDirection="column">
      {/* the row — identity ............ vitals */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={glyphColor}>{statusGlyph(agent.status)} </span>
          <span fg={nameColor} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {clip(name, narrow ? 18 : 28)}
          </span>
          {!narrow && agent.branch ? (
            <span>
              <span fg={projectHue(agent.project)}>{` ${icon.branch} `}</span>
              <span fg={idle ? color.faint : color.dim}>{clip(agent.branch, 24)}</span>
            </span>
          ) : null}
          {agent.procs > 1 && <span fg={color.dim}>{`  ×${agent.procs}`}</span>}
          {agent.kind === "codex" && <span fg={color.faint}>{`  ${icon.codex} codex`}</span>}
        </text>
        {urgent ? (
          <text>
            <span fg={urgentColor}>{urgentWord} </span>
            <Stat s={fmtDuration(agent.idleSec)} value={urgentColor} unit={color.dim} />
          </text>
        ) : showDiff ? (
          <text>
            <span fg={color.positive}>+{agent.diff!.plus}</span>
            <span fg={color.danger}> −{agent.diff!.minus}</span>
            <span fg={color.dim}>
              {"  "}
              {agent.diff!.files} {agent.diff!.files === 1 ? "file" : "files"}
            </span>
          </text>
        ) : agent.status === "unknown" ? (
          <text fg={color.faint}>—</text>
        ) : (
          <text>
            {/* the EKG: real transcript cadence — dense = cranking, flat = stalled */}
            {ekgSlot && <span fg={color.dim}>{ekgSlot}</span>}
            {!narrow && (
              <span>
                <span fg={ctxColor(agent.contextPct)}>{cells.filled}</span>
                <span fg={color.faint}>{cells.ghost}</span>
                <span fg={color.faint}>{cells.trough}</span>
              </span>
            )}
            <span> </span>
            <Stat
              s={`${String(Math.round(agent.contextPct)).padStart(3)}%`}
              value={agent.contextPct >= 70 ? ctxColor(agent.contextPct) : idle ? color.dim : color.fg}
              unit={idle ? color.faint : color.dim}
            />
            <span fg={color.dim}>{agent.ctxGhostPct !== undefined ? "⟳" : " "}</span>
            <span> </span>
            <Stat
              s={fmtCost(agent.costUsd).padStart(6)}
              value={idle ? color.dim : color.fg}
              unit={idle ? color.faint : color.dim}
            />
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

      {/* disclosed detail — the session's story, not a tool log:
          task (what you asked) · now (what it's doing) · said (its last words)
          · built (what it produced), then vitals and place */}
      {expanded && (
        <box flexDirection="column">
          {(agent.task ? wrapText(`“${agent.task}”`, textW - 6, 2) : []).map((l, i) => (
            <text key={`t${i}`}>
              <span fg={color.faint}>
                {INDENT}
                {i === 0 ? `${icon.task} task  ` : "        "}
              </span>
              <span fg={color.fg}>{l}</span>
            </text>
          ))}
          {!urgent && agent.lastTool && (
            <text>
              <span fg={color.faint}>
                {INDENT}
                {icon.pulse} {agent.status === "working" ? "now   " : "last  "}
              </span>
              <span fg={color.dim}>{clip(agent.lastTool, textW - 18)}</span>
              <span fg={color.faint}> · </span>
              <Stat s={`${fmtDuration(agent.idleSec)} ago`} value={color.dim} unit={color.faint} />
            </text>
          )}
          {agent.lastSaid && (
            <text>
              <span fg={color.faint}>{`${INDENT}${icon.comment} said  `}</span>
              <span fg={color.dim}>“{clip(agent.lastSaid, textW - 10)}”</span>
            </text>
          )}
          {agent.diff && agent.diff.files > 0 && (
            <text>
              <span fg={color.faint}>{`${INDENT}${icon.diff} built `}</span>
              <span fg={color.positive}>+{agent.diff.plus}</span>
              <span fg={color.danger}> −{agent.diff.minus}</span>
              <span fg={color.dim}> across </span>
              <Stat s={`${agent.diff.files} ${agent.diff.files === 1 ? "file" : "files"}`} />
              <span fg={color.dim}>, uncommitted</span>
            </text>
          )}
          {/* the story above, the vitals below */}
          <text fg={color.faint}>
            {INDENT}
            {"─".repeat(Math.max(12, Math.min(textW, 48)))}
          </text>
          <text>
            <span fg={color.dim}>
              {INDENT}
              {agent.model} ·{" "}
            </span>
            <Stat s={`${fmtTokens(agent.tokens)} tok`} />
            <span fg={color.dim}> · {glyph.clock} </span>
            <Stat s={fmtDuration(agent.uptimeSec)} />
            <span fg={color.dim}> · </span>
            <Stat s={`pid ${agent.pid}`} />
            {agent.burnPerHour !== undefined && agent.burnPerHour >= 0.05 && (
              <span>
                <span fg={color.dim}> · </span>
                <Stat s={`$${agent.burnPerHour.toFixed(1)}/h`} />
              </span>
            )}
            {agent.planPct !== undefined && (
              <span>
                <span fg={color.dim}> · </span>
                <Stat
                  s={`plan ${Math.round(agent.planPct)}%`}
                  value={agent.planPct >= 80 ? color.attention : color.fg}
                />
              </span>
            )}
            {urgent && (
              <span>
                <span fg={color.dim}>{"  ctx "}</span>
                <Stat
                  s={`${Math.round(agent.contextPct)}%`}
                  value={agent.contextPct >= 70 ? ctxColor(agent.contextPct) : color.fg}
                />
                <span> </span>
                <Stat s={fmtCost(agent.costUsd)} />
              </span>
            )}
          </text>
          <text fg={color.faint}>
            {INDENT}
            {icon.dir} {shorten(agent.cwd)}
          </text>
        </box>
      )}
    </box>
  )
}
