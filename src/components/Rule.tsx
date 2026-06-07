import { color } from "../theme"

/** Full-width separator that auto-fills its parent (no manual width math). */
export function Rule() {
  return <box border={["bottom"]} borderStyle="single" borderColor={color.faint} height={1} />
}
