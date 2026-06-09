import { TextAttributes } from "@opentui/core"
import type { RepoWorktrees } from "../types"
import { color, glyph } from "../theme"

/** One repo's worktrees as a calm one-liner. */
export function WorktreeCard({ wt, selected = false }: { wt: RepoWorktrees; selected?: boolean }) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text>
        <span fg={color.accent}>{selected ? glyph.gutter : " "}</span>
        <span fg={color.dim}>{glyph.dot} </span>
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
