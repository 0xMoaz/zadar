#!/usr/bin/env bun
/** Print one live snapshot as JSON — verifies collectors without the TUI. */
import { collect } from "./collect"

const snap = await collect()
console.log(JSON.stringify(snap, null, 2))
process.exit(0)
