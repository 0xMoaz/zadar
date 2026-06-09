import { describe, expect, test } from "bun:test"
import { identityOf } from "./collect"
import { etimeToSec } from "./collectors/process"
import { parseShortstat } from "./collectors/diff"

describe("identityOf — worktree sessions keep their repo", () => {
  test("plain repo cwd", () => {
    expect(identityOf("/Users/zee/Code/webapp")).toEqual({ project: "webapp" })
  })

  test("worktree cwd → repo + worktree name", () => {
    expect(identityOf("/Users/zee/Code/webapp/.claude/worktrees/fix-auth")).toEqual({
      project: "webapp",
      wt: "fix-auth",
    })
  })

  test("trailing slash tolerated", () => {
    expect(identityOf("/Users/zee/Code/webapp/.claude/worktrees/fix-auth/")).toEqual({
      project: "webapp",
      wt: "fix-auth",
    })
  })

  test("dotted repo names survive", () => {
    expect(identityOf("/Users/zee/Code/zee.gg")).toEqual({ project: "zee.gg" })
  })
})

describe("etimeToSec", () => {
  test("mm:ss", () => expect(etimeToSec("08:30")).toBe(510))
  test("hh:mm:ss", () => expect(etimeToSec("02:00:05")).toBe(7205))
  test("dd-hh:mm:ss", () => expect(etimeToSec("1-00:00:10")).toBe(86410))
})

describe("parseShortstat", () => {
  test("full shape", () => {
    expect(parseShortstat(" 9 files changed, 214 insertions(+), 38 deletions(-)")).toEqual({
      files: 9,
      plus: 214,
      minus: 38,
    })
  })
  test("insertions only / singular forms", () => {
    expect(parseShortstat(" 1 file changed, 1 insertion(+)")).toEqual({ files: 1, plus: 1, minus: 0 })
  })
  test("clean tree → undefined", () => {
    expect(parseShortstat("")).toBeUndefined()
  })
})
