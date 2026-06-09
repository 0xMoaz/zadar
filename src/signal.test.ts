import { describe, expect, test } from "bun:test"
import { burnRate, diffTransitions, ghostVisible, pushSample, trackGhost, type BurnSample } from "./signal"

describe("burn rate", () => {
  test("needs two samples", () => {
    expect(burnRate([])).toBe(0)
    expect(burnRate([{ t: 0, cost: 1 }])).toBe(0)
  })

  test("$/h from cost delta over the window", () => {
    const samples: BurnSample[] = [
      { t: 0, cost: 1.0 },
      { t: 30 * 60_000, cost: 3.5 }, // +$2.50 over 30m → $5/h
    ]
    expect(burnRate(samples)).toBeCloseTo(5, 5)
  })

  test("window drops stale samples", () => {
    let s: BurnSample[] = []
    s = pushSample(s, 0, 0)
    s = pushSample(s, 5 * 60_000, 1)
    s = pushSample(s, 20 * 60_000, 2) // first sample now out of the 10m window
    expect(s[0].t).toBe(5 * 60_000)
  })

  test("cost never burns backwards", () => {
    expect(
      burnRate([
        { t: 0, cost: 5 },
        { t: 60_000, cost: 1 },
      ]),
    ).toBe(0)
  })
})

describe("transitions", () => {
  test("detects flips and appearances", () => {
    const prev = new Map([["a1", "working" as const]])
    const agents = [
      { id: "a1", project: "webapp", status: "waiting" as const },
      { id: "a2", project: "docs", status: "ready" as const },
    ]
    const t = diffTransitions(prev, agents, 1000)
    expect(t).toHaveLength(2)
    expect(t[0]).toMatchObject({ id: "a1", from: "working", to: "waiting" })
    expect(t[1]).toMatchObject({ id: "a2", from: undefined, to: "ready" })
  })

  test("steady state is silent", () => {
    const prev = new Map([["a1", "working" as const]])
    expect(diffTransitions(prev, [{ id: "a1", project: "webapp", status: "working" }], 0)).toHaveLength(0)
  })

  test("worktree agents label as repo/wt", () => {
    const t = diffTransitions(new Map(), [{ id: "x", project: "webapp", wt: "fix-auth", status: "ready" }], 0)
    expect(t[0].project).toBe("webapp/fix-auth")
  })
})

describe("compaction ghost", () => {
  test("a sudden drop leaves a ghost at the high-water mark", () => {
    let st = trackGhost(undefined, 90, 0)
    st = trackGhost(st, 96, 1000)
    st = trackGhost(st, 40, 2000) // compaction: 96 → 40
    expect(st.ghost).toBe(96)
    expect(ghostVisible(st, 30_000)).toBe(96)
  })

  test("the ghost fades after a minute", () => {
    let st = trackGhost(undefined, 96, 0)
    st = trackGhost(st, 40, 1000)
    st = trackGhost(st, 41, 70_000)
    expect(ghostVisible(st, 70_000)).toBeUndefined()
  })

  test("gradual growth never ghosts", () => {
    let st = trackGhost(undefined, 50, 0)
    st = trackGhost(st, 60, 1000)
    st = trackGhost(st, 58, 2000) // small wobble, not a compaction
    expect(st.ghost).toBeUndefined()
    expect(st.hwm).toBe(60)
  })
})
