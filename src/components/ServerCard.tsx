import { TextAttributes } from "@opentui/core"
import type { DevServer } from "../types"
import { color, glyph, serverMemColor } from "../theme"
import { clip, fmtMem, shorten } from "../format"

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
  const meta = server.branch && !narrow ? `${server.project} · ${server.branch}` : server.project
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
          <span fg={color.dim}>{`  ${clip(meta, narrow ? 14 : 32)}`}</span>
          {!live && <span fg={color.attention}>  stale</span>}
        </text>
        <text>
          <span fg={serverMemColor(server.memKB)}>
            {fmtMem(server.memKB)}
            {heavy ? ` ${glyph.warn}` : ""}
          </span>
          <span fg={color.dim}>{`  ${glyph.clock} ${server.uptime}`}</span>
        </text>
      </box>
      {expanded && (
        <box flexDirection="column">
          <text fg={color.dim}>
            {"     "}pid {server.pid}
            {server.stale ? " · cwd is gone (orphaned worktree) — safe to kill" : ""}
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
