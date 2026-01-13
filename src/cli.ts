import { Command } from "commander"
import { join } from "path"
import { render } from "ink"
import React from "react"
import { App } from "./components/App.js"
import { InitRalph } from "./components/InitRalph.js"
import { getClaudeVersion } from "./lib/getClaudeVersion.js"
import { addTodo } from "./lib/addTodo.js"
import packageJson from "../package.json" with { type: "json" }

export const program = new Command()
  .name("ralph")
  .description("Autonomous AI iteration engine for Claude CLI")
  .version(packageJson.version)
  .argument("[iterations]", "number of iterations to run", val => parseInt(val, 10), 10)
  .option("--replay [file]", "replay events from log file")
  .action((iterations, options) => {
    const replayFile =
      options.replay !== undefined ?
        typeof options.replay === "string" ?
          options.replay
        : join(process.cwd(), ".ralph", "events.log")
      : undefined

    const claudeVersion = getClaudeVersion()
    const ralphVersion = packageJson.version

    render(React.createElement(App, { iterations, replayFile, claudeVersion, ralphVersion }))
  })

program
  .command("init")
  .description("initialize .ralph directory with templates")
  .action(() => {
    render(React.createElement(InitRalph))
  })

program
  .command("todo [description...]")
  .description("add a todo item and commit it (safe to use while ralph is running)")
  .action(async (descriptionParts: string[]) => {
    let description = descriptionParts.join(" ").trim()

    if (!description) {
      // Prompt for description interactively
      const readline = await import("readline")
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      description = await new Promise<string>(resolve => {
        rl.question("Todo: ", answer => {
          rl.close()
          resolve(answer.trim())
        })
      })

      if (!description) {
        console.error("No todo description provided")
        process.exit(1)
      }
    }

    try {
      addTodo(description)
    } catch (error) {
      console.error(`Failed to add todo: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  })
