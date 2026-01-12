import { Command } from "commander"
import { join } from "path"
import { render } from "ink"
import React from "react"
import { App } from "./components/App.js"
import { InitRalph } from "./components/InitRalph.js"

export const program = new Command()
  .name("ralph")
  .description("Autonomous AI iteration engine for Claude CLI")
  .version("0.2.0")
  .argument("[iterations]", "number of iterations to run", val => parseInt(val, 10), 10)
  .option("--replay [file]", "replay events from log file")
  .action((iterations, options) => {
    const replayFile =
      options.replay !== undefined ?
        typeof options.replay === "string" ?
          options.replay
        : join(process.cwd(), ".ralph", "events.log")
      : undefined

    const claudeVersion = process.env.CLAUDE_VERSION || "unknown"

    render(React.createElement(App, { iterations, replayFile, claudeVersion }))
  })

program
  .command("init")
  .description("initialize .ralph directory with templates")
  .action(() => {
    render(React.createElement(InitRalph))
  })
