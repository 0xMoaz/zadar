import { describe, expect, test } from "bun:test"
import { clip, ctxCells, fmtDuration, fmtMem, fmtTokens, sparkline, wrapText } from "./format"

describe("fmtDuration", () => {
  test("compact single-unit", () => {
    expect(fmtDuration(45)).toBe("45s")
    expect(fmtDuration(8 * 60)).toBe("8m")
    expect(fmtDuration(3600)).toBe("1h")
    expect(fmtDuration(2 * 3600 + 5 * 60)).toBe("2h5m")
  })
})

describe("fmtMem / fmtTokens", () => {
  test("KB scaling", () => {
    expect(fmtMem(14 * 1024 * 1024)).toBe("14G")
    expect(fmtMem(9.8 * 1024 * 1024)).toBe("9.8G")
    expect(fmtMem(512 * 1024)).toBe("512M")
  })
  test("token scaling", () => {
    expect(fmtTokens(192_000)).toBe("192k")
    expect(fmtTokens(1_200_000)).toBe("1.2M")
    expect(fmtTokens(900)).toBe("900")
  })
})

describe("ctxCells", () => {
  test("fills proportionally and clamps", () => {
    expect(ctxCells(0, 6)).toEqual({ filled: "", ghost: "", trough: "▱▱▱▱▱▱" })
    expect(ctxCells(50, 6).filled.length).toBe(3)
    expect(ctxCells(120, 6)).toEqual({ filled: "▰▰▰▰▰▰", ghost: "", trough: "" })
  })

  test("compaction ghost fills between live and high-water mark", () => {
    const c = ctxCells(40, 6, 90)
    expect(c.filled).toBe("▰▰")
    expect(c.ghost).toBe("▰▰▰")
    expect(c.trough).toBe("▱")
  })

  test("ghost below the live fill is ignored", () => {
    expect(ctxCells(80, 6, 40).ghost).toBe("")
  })
})

describe("wrapText", () => {
  test("wraps on word boundaries", () => {
    expect(wrapText("should I overwrite the existing config", 20, 3)).toEqual([
      "should I overwrite",
      "the existing config",
    ])
  })
  test("respects maxLines and marks truncation", () => {
    const lines = wrapText("one two three four five six seven eight nine ten", 10, 2)
    expect(lines.length).toBe(2)
    expect(lines[1].endsWith("…")).toBe(true)
  })
  test("short text stays one line", () => {
    expect(wrapText("hello world", 40)).toEqual(["hello world"])
  })
  test("overlong single word is clipped, not looped", () => {
    expect(wrapText("supercalifragilistic", 10)).toEqual(["supercali…"])
  })
})

describe("sparkline / clip", () => {
  test("sparkline spans min..max", () => {
    const s = sparkline([0, 50, 100])
    expect(s.length).toBe(3)
    expect(s[0]).toBe("▁")
    expect(s[2]).toBe("█")
  })
  test("clip adds ellipsis only when needed", () => {
    expect(clip("short", 10)).toBe("short")
    expect(clip("a-very-long-name", 8)).toBe("a-very-…")
  })
})
