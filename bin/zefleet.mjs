#!/usr/bin/env node
// Thin Node launcher so `npx github:0xMoaz/zefleet` (and `bunx`) work everywhere.
// zefleet is a Bun app (it uses Bun's shell + runs .tsx directly), so we hand off to Bun.
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const entry = join(root, "src", "index.tsx")

const child = spawn("bun", [entry, ...process.argv.slice(2)], { stdio: "inherit" })

child.on("error", (err) => {
  if (err && err.code === "ENOENT") {
    process.stderr.write(
      "\n  zefleet needs Bun to run.\n" +
        "  Install it:  curl -fsSL https://bun.sh/install | bash\n" +
        "  Then re-run: npx github:0xMoaz/zefleet\n\n",
    )
    process.exit(127)
  }
  throw err
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
