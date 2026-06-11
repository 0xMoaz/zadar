import { color } from "../theme"

/** A compact key chip — the key on a subtle painted cell, one space of air each side. */
export function Keycap({ k }: { k: string }) {
  return (
    <span fg={color.fg} bg={color.pill}>
      {` ${k} `}
    </span>
  )
}
