import { $ } from "bun"
import type { SystemStat } from "../types"

let memHist: number[] = []

/** "5377.50M" → "5.3G", "512.00M" → "512M", "0.00M" → "0" */
function fmtSwap(raw: string): string {
  const m = raw.match(/([\d.]+)([MG]?)/)
  if (!m) return raw
  let mb = parseFloat(m[1])
  if (m[2] === "G") mb *= 1024
  if (mb < 1) return "0"
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`
  return `${Math.round(mb)}M`
}

export async function collectSystem(): Promise<SystemStat> {
  const total = parseInt((await $`sysctl -n hw.memsize`.nothrow().quiet().text()).trim(), 10) || 0
  const pagesize = parseInt((await $`sysctl -n hw.pagesize`.nothrow().quiet().text()).trim(), 10) || 16384
  const vm = await $`vm_stat`.nothrow().quiet().text()

  const num = (re: RegExp) => {
    const m = vm.match(re)
    return m ? parseInt(m[1].replace(/\./g, ""), 10) : 0
  }
  const active = num(/Pages active:\s+(\d+)/)
  const wired = num(/Pages wired down:\s+(\d+)/)
  const comp = num(/occupied by compressor:\s+(\d+)/)
  const used = (active + wired + comp) * pagesize
  const pct = total ? Math.round((used * 100) / total) : 0

  const swapRaw = (await $`sysctl -n vm.swapusage`.nothrow().quiet().text()).match(/used = (\S+)/)?.[1] ?? "0M"
  const swap = fmtSwap(swapRaw)
  const lm = (await $`sysctl -n vm.loadavg`.nothrow().quiet().text()).match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  const load: [number, number, number] = lm
    ? [parseFloat(lm[1]), parseFloat(lm[2]), parseFloat(lm[3])]
    : [0, 0, 0]

  memHist.push(pct)
  if (memHist.length > 16) memHist.shift()

  return {
    usedGB: Math.round(used / 1073741824),
    totalGB: Math.round(total / 1073741824),
    pct,
    swap,
    load,
    memHistory: [...memHist],
  }
}
