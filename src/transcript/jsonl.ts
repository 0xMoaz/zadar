import { closeSync, openSync, readSync, statSync } from "node:fs"

/** read the last ~bytes of a file as text (transcripts reach many MB) */
export function tailText(path: string, bytes = 96 * 1024): string {
  const fd = openSync(path, "r")
  try {
    const size = statSync(path).size
    const start = Math.max(0, size - bytes)
    const len = size - start
    if (len <= 0) return ""
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, start)
    return buf.toString("utf8")
  } finally {
    closeSync(fd)
  }
}

/** parse JSONL tail text, dropping the possibly-partial first line */
export function parseTail(text: string): any[] {
  const lines = text.split("\n")
  lines.shift()
  const out: any[] = []
  for (const l of lines) {
    if (!l.trim()) continue
    try {
      out.push(JSON.parse(l))
    } catch {
      /* skip partial / malformed */
    }
  }
  return out
}

/** read just the first line (session_meta lines can be tens of KB) */
export function headLine(path: string, bytes = 128 * 1024): string {
  const fd = openSync(path, "r")
  try {
    const buf = Buffer.alloc(bytes)
    const n = readSync(fd, buf, 0, bytes, 0)
    const text = buf.toString("utf8", 0, n)
    const nl = text.indexOf("\n")
    return nl >= 0 ? text.slice(0, nl) : text
  } finally {
    closeSync(fd)
  }
}
