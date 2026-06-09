import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { codexCost, findCodexSession, inferCodexStatus, parseCodex } from "./codex"
import { priceFor } from "./pricing"

const ev = (payloadType: string, extra: any = {}) => ({
  timestamp: "2026-06-10T00:00:00Z",
  type: "event_msg",
  payload: { type: payloadType, ...extra },
})

const tokenCount = (lastTotal: number, window: number, total: any, usedPct = 45) =>
  ev("token_count", {
    info: {
      total_token_usage: total,
      last_token_usage: { total_tokens: lastTotal },
      model_context_window: window,
    },
    rate_limits: { primary: { used_percent: usedPct } },
  })

function fixtureRoot(cwd: string, events: any[]): string {
  const root = mkdtempSync(join(tmpdir(), "codex-"))
  const day = join(root, "2026", "06", "10")
  mkdirSync(day, { recursive: true })
  const meta = { timestamp: "2026-06-10T00:00:00Z", type: "session_meta", payload: { id: "sess-1", cwd } }
  writeFileSync(join(day, "rollout-test.jsonl"), [meta, ...events].map((e) => JSON.stringify(e)).join("\n") + "\n")
  return root
}

describe("inferCodexStatus", () => {
  test("task_started → working while fresh, idle when stalled", () => {
    expect(inferCodexStatus([ev("task_started")], 10)).toBe("working")
    expect(inferCodexStatus([ev("task_started")], 600)).toBe("idle")
  })
  test("task_complete → ready inside the review window", () => {
    expect(inferCodexStatus([ev("task_started"), ev("task_complete")], 60)).toBe("ready")
    expect(inferCodexStatus([ev("task_started"), ev("task_complete")], 21 * 60)).toBe("idle")
  })
  test("turn_aborted → idle", () => {
    expect(inferCodexStatus([ev("turn_aborted")], 5)).toBe("idle")
  })
})

describe("codexCost", () => {
  test("cached input priced at cacheRead, fresh at input", () => {
    const p = priceFor("gpt")
    const cost = codexCost({ input_tokens: 3_000_000, cached_input_tokens: 2_000_000, output_tokens: 100_000 })
    expect(cost).toBeCloseTo((1_000_000 * p.input + 2_000_000 * p.cacheRead + 100_000 * p.output) / 1e6, 6)
  })
})

describe("session discovery + full parse", () => {
  test("matches session_meta.cwd and derives all signals from the tail", () => {
    const cwd = "/Users/zee/Code/argo"
    const root = fixtureRoot(cwd, [
      ev("task_started"),
      ev("agent_message", { message: "Auditing the repo structure now." }),
      tokenCount(138_794, 258_400, {
        input_tokens: 29_625_827,
        cached_input_tokens: 26_928_000,
        output_tokens: 99_152,
        total_tokens: 29_724_979,
      }),
      ev("task_complete"),
    ])

    const sig = parseCodex(cwd, "gpt-5.5", Date.now(), root)
    expect(sig).not.toBeNull()
    expect(sig!.sessionId).toBe("sess-1")
    expect(sig!.status).toBe("ready")
    expect(Math.round(sig!.contextPct)).toBe(54) // 138794 / 258400
    expect(sig!.tokens).toBe(29_724_979)
    expect(sig!.planPct).toBe(45)
    expect(sig!.lastActivity).toBe("Auditing the repo structure now.")
    expect(sig!.costUsd).toBeGreaterThan(0)
  })

  test("no matching cwd → null", () => {
    const root = fixtureRoot("/Users/zee/Code/other", [ev("task_started")])
    expect(findCodexSession("/Users/zee/Code/argo", root)).toBeNull()
    expect(parseCodex("/Users/zee/Code/argo", "gpt", Date.now(), root)).toBeNull()
  })
})
