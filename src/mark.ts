import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
// a real path in dev, embedded bytes in `bun build --compile` binaries
import fontSrc from "../assets/ZadarMark.ttf" with { type: "file" }

const FONT = "ZadarMark.ttf"
const dest =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Fonts", FONT)
    : join(homedir(), ".local", "share", "fonts", FONT)

/**
 * The header mark (U+E100) renders only via the bundled "Zadar Mark" font.
 * U+E100 sits in a private-use gap that neither Nerd Fonts nor common terminal
 * fonts claim, so once the font is installed every terminal's system-fallback
 * discovery resolves it without configuration.
 *
 * A terminal only sees fonts present when it started — so a font installed
 * just now can't render this run. Returns true only when the font predates
 * the run; otherwise installs it quietly and the mark lights up on the next
 * terminal session. Until then (or wherever installing fails) the header is
 * the plain wordmark.
 */
export function ensureMark(): boolean {
  if (process.platform !== "darwin" && process.platform !== "linux") return false
  try {
    if (existsSync(dest)) return true
    mkdirSync(dirname(dest), { recursive: true })
    void Bun.write(dest, Bun.file(fontSrc))
  } catch {
    /* read-only home / odd packaging — wordmark is fine */
  }
  return false
}
