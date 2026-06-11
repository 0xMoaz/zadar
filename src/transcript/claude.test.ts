import { describe, expect, test } from "bun:test"
import { windowFor } from "./claude"

describe("windowFor — context window detection", () => {
  test("[1m] flag is definitive", () => {
    expect(windowFor("claude-opus-4-8[1m]")).toBe(1_000_000)
    expect(windowFor("claude-fable-5[1m]")).toBe(1_000_000)
    expect(windowFor("claude-haiku-4-5[1m]")).toBe(1_000_000) // flag overrides capability
  })

  test("1M-capable models default to 1M (no flag needed)", () => {
    expect(windowFor("claude-opus-4-8")).toBe(1_000_000) // the bug we fixed
    expect(windowFor("claude-opus-4-6")).toBe(1_000_000) // Opus 4.6 boundary
    expect(windowFor("claude-opus-5-0")).toBe(1_000_000) // future Opus
    expect(windowFor("claude-sonnet-4-6")).toBe(1_000_000) // Sonnet 4+
    expect(windowFor("claude-fable-5")).toBe(1_000_000) // Fable 5
  })

  test("non-1M models stay at 200k", () => {
    expect(windowFor("claude-haiku-4-5-20251001")).toBe(200_000) // Haiku is 200k
    expect(windowFor("claude-opus-4-5")).toBe(200_000) // below the 4.6 boundary
    expect(windowFor("claude-3-5-sonnet-20241022")).toBe(200_000) // old naming: date ≠ version
    expect(windowFor("")).toBe(200_000) // unknown → safe default
  })
})
