import { memo } from "react"
import { TextAttributes, type RGBA } from "@opentui/core"
import { color, glyph as G, spinnerFrame, workFrame } from "../theme"
import { clip, wrapText } from "../format"
import { Stat } from "./Stat"

/**
 * One signal line for the compact (sticky-HUD) tier: a blip that carries state +
 * severity (and pulses when live), the name, the TYPE of attention in the blip's
 * colour, an optional age, and a clipped fragment of context — never wrapped, never
 * a right column. At a glance you read "what kind, whose, how long, about what".
 */
export type Signal = {
  glyph: string
  glyphColor: RGBA
  /** sparkle = needs-you ask, work = advancing; both ride the shared tick */
  live?: "sparkle" | "work" | null
  name: string
  typeWord?: string
  typeColor?: RGBA
  age?: string
  context?: string
}

export const SignalLine = memo(function SignalLine({
  signal,
  selected,
  width,
  twoLine = false,
  expanded = false,
  tick = 0,
}: {
  signal: Signal
  selected: boolean
  width: number
  /** when there's vertical room: head on line 1, full context wrapped beneath */
  twoLine?: boolean
  /** disclosed: render the head only — the detail block below carries the context */
  expanded?: boolean
  tick?: number
}) {
  const { glyph, glyphColor, live, name, typeWord, typeColor, age, context } = signal
  const g = live === "sparkle" ? spinnerFrame(tick) : live === "work" ? workFrame(tick) : glyph

  const head = (
    <text>
      <span fg={color.accent}>{selected ? G.gutter : " "}</span>
      <span fg={glyphColor}>{g} </span>
      <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
        {clip(name, Math.max(12, width - 12))}
      </span>
      {typeWord ? <span fg={typeColor ?? glyphColor}>{` ${typeWord}`}</span> : null}
      {age ? (
        <span>
          <span>{" "}</span>
          <Stat s={age} value={typeColor ?? color.dim} unit={color.dim} />
        </span>
      ) : null}
    </text>
  )

  // disclosed → head only; the SignalDetail block beneath shows the full story
  if (expanded) return head

  // two-line block: the context earns its own (wrapped) line instead of being
  // clipped onto the end of the signal — used by Needs/Sessions when height allows
  if (twoLine && context) {
    return (
      <box flexDirection="column">
        {head}
        {wrapText(context, Math.max(10, width - 3), 2).map((l, i) => (
          <text key={i} fg={color.dim}>
            {`   ${l}`}
          </text>
        ))}
      </box>
    )
  }

  const nm = clip(name, Math.min(18, Math.max(10, width - 16)))
  // budget the line so context ellipsizes instead of wrapping
  let used = 2 + 2 + nm.length // gutter + glyph + name
  if (typeWord) used += 1 + typeWord.length
  if (age) used += 1 + age.length
  const ctx = context ? clip(context, Math.max(0, width - used - 3)) : ""
  return (
    <text>
      <span fg={color.accent}>{selected ? G.gutter : " "}</span>
      <span fg={glyphColor}>{g} </span>
      <span fg={color.fg} attributes={selected ? TextAttributes.BOLD : TextAttributes.NONE}>
        {nm}
      </span>
      {typeWord ? <span fg={typeColor ?? glyphColor}>{` ${typeWord}`}</span> : null}
      {age ? (
        <span>
          <span>{" "}</span>
          <Stat s={age} value={typeColor ?? color.dim} unit={color.dim} />
        </span>
      ) : null}
      {ctx ? <span fg={color.dim}>{` · ${ctx}`}</span> : null}
    </text>
  )
})
