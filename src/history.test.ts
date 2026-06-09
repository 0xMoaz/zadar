import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { appendEvents, loadToday } from "./history"
import { rhythmOf } from "./signal"
import type { Transition } from "./signal"

describe("history persistence", () => {
  const file = join(mkdtempSync(join(tmpdir(), "zf-hist-")), "events.jsonl")
  const now = Date.now()
  const tr = (t: number, to: Transition["to"]): Transition => ({ t, id: "a1", project: "webapp", from: "working", to })

  test("events round-trip across restarts", () => {
    appendEvents([tr(now - 60_000, "waiting"), tr(now - 30_000, "ready")], file)
    const loaded = loadToday(now, file)
    expect(loaded).toHaveLength(2)
    expect(loaded[1].to).toBe("ready")
  })

  test("yesterday's flips don't reload", () => {
    appendEvents([tr(now - 26 * 3600_000, "error")], file)
    const loaded = loadToday(now, file)
    expect(loaded.every((t) => t.to !== "error")).toBe(true)
  })

  test("missing file → empty story", () => {
    expect(loadToday(now, "/nonexistent/zf/events.jsonl")).toEqual([])
  })
})

describe("rhythmOf — the EKG", () => {
  const now = Date.parse("2026-06-10T12:00:00Z")
  const ev = (secAgo: number) => ({ timestamp: new Date(now - secAgo * 1000).toISOString() })

  test("buckets recent events oldest → newest", () => {
    const r = rhythmOf([ev(115), ev(5), ev(3), ev(1)], now, 12, 10_000)
    expect(r).toHaveLength(12)
    expect(r[0]).toBe(1) // ~115s ago → first bucket
    expect(r[11]).toBe(3) // the burst just now → last bucket
  })

  test("old and unstamped events don't count", () => {
    const r = rhythmOf([ev(500), {}, { timestamp: "garbage" }], now, 12, 10_000)
    expect(r.reduce((a, b) => a + b, 0)).toBe(0)
  })
})
