import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { costOf, priceFor, type Usage } from "./pricing"
import { accrueCost } from "./claude"

describe("priceFor", () => {
  test("maps model families", () => {
    expect(priceFor("claude-opus-4-8").input).toBe(5)
    expect(priceFor("claude-sonnet-4-6").input).toBe(3)
    expect(priceFor("claude-haiku-4-5").input).toBe(1)
    expect(priceFor("gpt-5.5").input).toBe(1.25)
  })

  test("unknown models fall back to sonnet tier", () => {
    expect(priceFor("mystery-model")).toEqual(priceFor("sonnet"))
  })
})

describe("costOf", () => {
  const u: Usage = { input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 500_000 }

  test("opus math", () => {
    // 1M·$5 + 0.1M·$25 + 2M·$0.5 + 0.5M·$6.25 = 5 + 2.5 + 1 + 3.125
    expect(costOf(u, "claude-opus-4-8")).toBeCloseTo(11.625, 5)
  })
})

describe("accrueCost — per-event model pricing", () => {
  test("a session that switches models prices each event at its own model", () => {
    const dir = mkdtempSync(join(tmpdir(), "zefleet-"))
    const path = join(dir, "mixed.jsonl")
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    }
    const ev = (id: string, model: string) =>
      JSON.stringify({ type: "assistant", requestId: id, message: { id, model, usage } })
    writeFileSync(path, [ev("r1", "claude-opus-4-8"), ev("r2", "claude-haiku-4-5")].join("\n") + "\n")

    const { tokens, cost } = accrueCost(path, "claude-opus-4-8", statSync(path).mtimeMs)
    expect(tokens).toBe(2_000_000)
    expect(cost).toBeCloseTo(5 + 1, 5) // opus $5/M + haiku $1/M — NOT 2×opus
  })

  test("duplicate (requestId, message.id) events are counted once", () => {
    const dir = mkdtempSync(join(tmpdir(), "zefleet-"))
    const path = join(dir, "dupes.jsonl")
    const usage = { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const line = JSON.stringify({
      type: "assistant",
      requestId: "rX",
      message: { id: "mX", model: "claude-haiku-4-5", usage },
    })
    writeFileSync(path, [line, line].join("\n") + "\n")
    const { tokens } = accrueCost(path, "claude-haiku-4-5", statSync(path).mtimeMs)
    expect(tokens).toBe(100)
  })
})
