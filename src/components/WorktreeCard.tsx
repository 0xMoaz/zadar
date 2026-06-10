import { TextAttributes } from "@opentui/core"
import type { RepoWorktrees, WorktreeItem } from "../types"
import { color, glyph, icon, projectHue } from "../theme"
import { clip } from "../format"
import { Stat } from "./Stat"

/** One repo's worktrees as a calm one-liner; Enter drills into the trees. */
export function WorktreeCard({
  wt,
  selected = false,
  expanded = false,
}: {
  wt: RepoWorktrees
  selected?: boolean
  expanded?: boolean
}) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>{expanded ? glyph.expanded : glyph.collapsed} </span>
        <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
          {wt.repo}
        </span>
      </text>
      <text>
        <span fg={color.dim}>
          {wt.total} {wt.total === 1 ? "tree" : "trees"}
        </span>
        {wt.changed > 0 ? (
          <span fg={color.attention}>{" · "}{wt.changed} dirty</span>
        ) : (
          <span fg={color.faint}>{" · clean"}</span>
        )}
      </text>
    </box>
  )
}

/** One worktree inside a drilled-open repo: name · branch ... state · age. */
export function WorktreeItemRow({
  item,
  repo,
  selected = false,
  width,
}: {
  item: WorktreeItem
  repo: string
  selected?: boolean
  width: number
}) {
  const clean = item.dirty === 0
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>{"  "}</span>
        <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
          {clip(item.name, width < 70 ? 18 : 28)}
        </span>
        {item.branch && width >= 70 && (
          <span>
            <span fg={projectHue(repo)}>{` ${icon.branch} `}</span>
            <span fg={color.dim}>{clip(item.branch, 24)}</span>
          </span>
        )}
      </text>
      <text>
        {clean ? (
          <span fg={color.faint}>clean</span>
        ) : (
          <Stat s={`${item.dirty} dirty`} value={color.attention} unit={color.dim} />
        )}
        <span fg={color.dim}>{" · "}</span>
        {item.ageDays === 0 ? <span fg={color.dim}>today</span> : <Stat s={`${item.ageDays}d`} />}
      </text>
    </box>
  )
}
