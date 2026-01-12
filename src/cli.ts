import chalk from "chalk"
import { Command } from "commander"
import { existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { render } from "ink"
import React from "react"
import { App } from "./components/App.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const program = new Command()
  .name("ralph")
  .description("Autonomous AI iteration engine for Claude CLI")
  .version("0.2.0")
  .argument("[iterations]", "number of iterations to run", (val) => parseInt(val, 10), 10)
  .option("--replay [file]", "replay events from log file")
  .action((iterations, options) => {
    const replayFile =
      options.replay !== undefined ?
        typeof options.replay === "string" ?
          options.replay
        : join(process.cwd(), ".ralph", "events.log")
      : undefined

    render(React.createElement(App, { iterations, replayFile }))
  })

program
  .command("init")
  .description("initialize .ralph directory with templates")
  .action(() => {
    initRalph()
  })

export const initRalph = () => {
  const ralphDir = join(process.cwd(), ".ralph")

  if (existsSync(ralphDir)) {
    console.log(chalk.yellow("⚠️  .ralph directory already exists"))
    console.log(chalk.dim("To reinitialize, remove the directory first: rm -rf .ralph"))
    return
  }

  console.log(chalk.cyan("Initializing ralph..."))

  mkdirSync(ralphDir, { recursive: true })

  // Copy templates from package installation
  const templatesDir = join(__dirname, "..", "templates")
  const templates = ["prompt.md", "todo.md", "progress.md"]

  for (const template of templates) {
    const src = join(templatesDir, template)
    const dest = join(ralphDir, template)

    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log(chalk.green("✓") + ` Created ${chalk.dim(".ralph/" + template)}`)
    } else {
      console.error(chalk.red("✗") + ` Template not found: ${template}`)
    }
  }

  console.log(chalk.green("\n✓ Ralph initialized successfully!"))
  console.log(chalk.dim("\nNext steps:"))
  console.log(chalk.dim("  1. Customize .ralph/prompt.md with your project's workflow"))
  console.log(chalk.dim("  2. Add tasks to .ralph/todo.md"))
  console.log(chalk.dim("  3. Run: ralph\n"))
}
