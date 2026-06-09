import { appendFileSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Transition } from "./signal"

const DEFAULT_FILE = join(process.env.HOME ?? "", ".zefleet", "events.jsonl")

/** the flight recorder outlives the process — every status flip, one line each */
export function appendEvents(trs: Transition[], file = DEFAULT_FILE): void {
  if (trs.length === 0) return
  try {
    mkdirSync(join(file, ".."), { recursive: true })
    appendFileSync(file, trs.map((t) => JSON.stringify(t)).join("\n") + "\n")
  } catch {
    /* history is best-effort */
  }
}

/** reload today's story on boot (capped to the most recent 200 flips) */
export function loadToday(nowMs: number, file = DEFAULT_FILE): Transition[] {
  try {
    const dayStart = new Date(nowMs)
    dayStart.setHours(0, 0, 0, 0)
    return readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Transition
        } catch {
          return null
        }
      })
      .filter((t): t is Transition => t !== null && typeof t.t === "number" && t.t >= dayStart.getTime())
      .slice(-200)
  } catch {
    return []
  }
}
