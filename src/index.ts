import { program } from "./cli.js"
import "./lib/signalHandler.js" // Register global SIGINT/SIGTERM handlers

export const run = () => {
  program.parse(process.argv)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
