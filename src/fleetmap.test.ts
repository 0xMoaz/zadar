import { describe, expect, test } from "bun:test"
import { attentionQueue, groupByProject } from "./fleetmap"
import { mockSnapshot } from "./mock"

describe("groupByProject", () => {
  const groups = groupByProject(mockSnapshot)

  test("alphabetical and stable — urgency never reorders the map", () => {
    expect(groups.map((g) => g.key)).toEqual([...groups.map((g) => g.key)].sort())
  })

  test("worktree agents and servers land in their parent repo", () => {
    const webapp = groups.find((g) => g.key === "webapp")!
    expect(webapp.agents.map((a) => a.wt)).toContain("fix-auth")
    expect(webapp.servers.map((s) => s.port)).toContain(3000)
    expect(webapp.worktrees?.total).toBe(2)
  })

  test("a server inside a worktree cwd groups under the repo", () => {
    const api = groups.find((g) => g.key === "api-gateway")!
    expect(api.servers.map((s) => s.port)).toContain(8787) // cwd is .../api-gateway/.claude/worktrees/gone
  })

  test("project rolls up cost and worst status", () => {
    const webapp = groups.find((g) => g.key === "webapp")!
    expect(webapp.worst).toBe("waiting")
    expect(webapp.cost).toBeCloseTo(3.9, 5)
  })
})

describe("attentionQueue", () => {
  const q = attentionQueue(mockSnapshot)

  test("ranked: question > approval > error > server-mem > ready > stale", () => {
    expect(q.map((i) => i.kind)).toEqual(["question", "approval", "error", "server-mem", "ready", "server-stale"])
  })

  test("titles are action sentences with the literal content", () => {
    expect(q[0].title).toContain("Should I overwrite the existing config")
    expect(q[3].title).toBe(":3000 holding 14G of memory")
    expect(q[4].title).toBe("review +214 −38 across 9 files")
  })

  test("queue items carry their target for direct actions", () => {
    expect(q[0].agent?.pid).toBe(74867)
    expect(q[3].server?.port).toBe(3000)
  })

  test("worktree agents are labelled repo/wt", () => {
    expect(q[1].project).toBe("omnipair/agent-3")
  })

  test("a calm fleet yields an empty queue", () => {
    expect(attentionQueue({ time: "", agents: [], servers: [], worktrees: [] })).toEqual([])
  })
})
