import { TextAttributes } from "@opentui/core"
import type { DevServer } from "../types"
import { color, glyph, icon, projectHue, serverMemColor } from "../theme"
import { clip, fmtMem, shorten } from "../format"
import { Stat } from "./Stat"

/** One dev server: a calm one-liner; Enter discloses where it lives. */
export function ServerCard({
  server,
  selected = false,
  expanded = false,
  width,
}: {
  server: DevServer
  selected?: boolean
  expanded?: boolean
  width: number
}) {
  const live = !server.stale
  const narrow = width < 70
  const url = narrow ? `:${server.port}` : `localhost:${server.port}`
  const heavy = server.memKB > 4 * 1024 * 1024
  return (
    <box flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={live ? color.positive : color.attention}>{live ? glyph.working : glyph.warn} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {url}
          </span>
          <span fg={color.dim}>{`  ${clip(server.project, narrow ? 14 : 16)}`}</span>
          {server.branch && !narrow ? (
            <span>
              <span fg={projectHue(server.project)}>{` ${icon.branch} `}</span>
              <span fg={color.dim}>{clip(server.branch, 18)}</span>
            </span>
          ) : null}
          {!live && <span fg={color.attention}>  stale</span>}
        </text>
        <text>
          <Stat s={fmtMem(server.memKB)} value={heavy ? serverMemColor(server.memKB) : color.fg} />
          {heavy && <span fg={serverMemColor(server.memKB)}> {glyph.warn}</span>}
          <span fg={color.dim}>{`  ${glyph.clock} `}</span>
          <Stat s={server.uptime} />
        </text>
      </box>
      {expanded && (
        <box flexDirection="column">
          <text>
            <span fg={color.dim}>{"     "}</span>
            <Stat s={`pid ${server.pid}`} />
            {server.stale && <span fg={color.dim}> · cwd is gone (orphaned worktree) — safe to kill</span>}
          </text>
          <text fg={color.faint}>
            {"     "}
            {server.cwd ? shorten(server.cwd) : "cwd unknown"}
          </text>
        </box>
      )}
    </box>
  )
}
