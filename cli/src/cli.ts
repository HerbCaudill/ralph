import { Command } from "commander"
import { render } from "ink"
import React from "react"
import { App } from "./components/App.js"
import { InitRalph } from "./components/InitRalph.js"
import { getClaudeVersion } from "./lib/getClaudeVersion.js"
import { getDefaultIterations } from "./lib/getDefaultIterations.js"
import { addTodo } from "./lib/addTodo.js"
import { getLatestLogFile } from "./lib/getLatestLogFile.js"
import packageJson from "../package.json" with { type: "json" }

export const program = new Command()
  .name("ralph")
  .description("Autonomous AI iteration engine for Claude CLI")
  .version(packageJson.version)
  .argument(
    "[iterations]",
    "number of iterations (default: 120% of open issues, min 10, max 100)",
    val => parseInt(val, 10),
  )
  .option("--replay [file]", "replay events from log file")
  .option("--watch", "watch for new beads issues after completion")
  .option("--json", "output events as newline-delimited JSON to stdout")
  .option("--agent <name>", "agent to use (e.g., claude, codex)", "claude")
  .action(
    (
      /** The number of iterations to run, or undefined to use default */
      iterationsArg: number | undefined,
      /** Command options including replay, watch, json, and agent */
      options,
    ) => {
      const iterations = iterationsArg ?? getDefaultIterations()
      const replayFile =
        options.replay !== undefined ?
          typeof options.replay === "string" ?
            options.replay
          : getLatestLogFile()
        : undefined

      const claudeVersion = getClaudeVersion()
      const ralphVersion = packageJson.version
      const watch = options.watch === true
      const json = options.json === true
      const agent = options.agent as string

      // Validate agent selection
      const validAgents = ["claude", "codex"]
      if (!validAgents.includes(agent)) {
        console.error(
          `Error: Invalid agent "${agent}". Available agents: ${validAgents.join(", ")}`,
        )
        process.exit(1)
      }

      // Clear the screen on startup (skip in JSON mode)
      if (!json) {
        process.stdout.write("\x1B[2J\x1B[H")
      }

      render(
        React.createElement(App, {
          iterations,
          replayFile,
          claudeVersion,
          ralphVersion,
          watch,
          json,
          agent,
        }),
      )
    },
  )

program
  .command("init")
  .description("initialize .ralph directory with templates")
  /**
   * Initialize the .ralph directory with templates
   */
  .action(() => {
    render(React.createElement(InitRalph))
  })

program
  .command("todo [description...]")
  .description("add a todo item and commit it (safe to use while ralph is running)")
  /**
   * Add a todo item and commit it. If description is provided as arguments,
   * use that; otherwise prompt interactively.
   */
  .action(
    async (
      /** The description parts from command arguments */
      descriptionParts: string[],
    ) => {
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
    },
  )
