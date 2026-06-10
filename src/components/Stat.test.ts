import { describe, expect, test } from "bun:test"
import { statSegs } from "./Stat"

const render = (s: string) =>
  statSegs(s)
    .map((x) => (x.v ? `[${x.t}]` : x.t))
    .join("")

describe("statSegs — value pops, unit recedes", () => {
  test("durations: digits bright, h/m grey", () => {
    expect(render("1h27m")).toBe("[1]h[27]m")
    expect(render("8m ago")).toBe("[8]m ago")
  })

  test("money: integer bright, $ and fraction grey", () => {
    expect(render("$54.83")).toBe("$[54].83")
    expect(render("$5.2/h")).toBe("$[5].2/h")
  })

  test("sizes and tokens", () => {
    expect(render("120M tok")).toBe("[120]M tok")
    expect(render("9.8G")).toBe("[9].8G")
    expect(render("14G")).toBe("[14]G")
  })

  test("percentages and labels", () => {
    expect(render("45%")).toBe("[45]%")
    expect(render("pid 18628")).toBe("pid [18628]")
    expect(render("3 trees")).toBe("[3] trees")
  })

  test("no digits → all unit", () => {
    expect(render("clean")).toBe("clean")
  })
})
