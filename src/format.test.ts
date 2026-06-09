import { describe, expect, test } from "bun:test"
import { clip, ctxCells, fmtDuration, fmtMem, fmtTokens, sparkline } from "./format"

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
    expect(fmtMem(14 * 1024 * 1024)).toBe("14.0G")
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
    expect(ctxCells(0, 6)).toEqual({ filled: "", trough: "▱▱▱▱▱▱" })
    expect(ctxCells(50, 6).filled.length).toBe(3)
    expect(ctxCells(120, 6)).toEqual({ filled: "▰▰▰▰▰▰", trough: "" })
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
