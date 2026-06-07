import { TextAttributes } from "@opentui/core"
import type { DevServer } from "../types"
import { color, glyph, serverMemColor } from "../theme"
import { clip, fmtMem } from "../format"

/** One dev server as a calm 2-line card (matches the agent-block aesthetic). */
export function ServerCard({
  server,
  selected = false,
  compact = false,
}: {
  server: DevServer
  selected?: boolean
  compact?: boolean
}) {
  const live = !server.stale
  const accent = live ? color.positive : color.attention
  const url = compact ? `:${server.port}` : `localhost:${server.port}`
  const meta = server.branch ? `${server.project} · ${server.branch}` : server.project
  const heavy = server.memKB > 4 * 1024 * 1024
  return (
    <box flexDirection="column">
      {/* line 1 — status + url ............ uptime */}
      <box flexDirection="row" justifyContent="space-between">
        <text>
          <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
          <span fg={accent}>{live ? glyph.working : glyph.warn} </span>
          <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
            {url}
          </span>
          {!live && <span fg={color.attention}>  stale</span>}
        </text>
        <text fg={color.dim}>
          {glyph.clock} {server.uptime}
        </text>
      </box>
      {/* line 2 — project · branch ............ memory */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={color.dim}>
          {"   "}
          {clip(meta, compact ? 16 : 30)}
        </text>
        <text fg={serverMemColor(server.memKB)}>
          {fmtMem(server.memKB)}
          {heavy ? ` ${glyph.warn}` : ""}
        </text>
      </box>
    </box>
  )
}
