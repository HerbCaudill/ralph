import { join } from "path"
import { replayLog } from "./lib/replayLog.js"
import { runIteration } from "./lib/runIteration.js"
import { parseArgs, showHelp, initRalph } from "./cli.js"

export const run = () => {
  const args = process.argv.slice(2)
  const parsed = parseArgs(args)

  if (parsed.mode === "help") {
    showHelp()
    return
  }

  if (parsed.mode === "init") {
    initRalph()
    return
  }

  if (parsed.mode === "replay") {
    replayLog(parsed.replayFile)
    return
  }

  if (parsed.mode === "run") {
    runIteration(1, parsed.iterations)
    return
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
