import chalk from "chalk"
import { existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export const parseArgs = (args: string[]) => {
  const replayIndex = args.indexOf("--replay")
  const initIndex = args.indexOf("init")
  const helpIndex = args.findIndex(a => a === "--help" || a === "-h")

  if (helpIndex !== -1) {
    return { mode: "help" as const }
  }

  if (initIndex !== -1) {
    return { mode: "init" as const }
  }

  if (replayIndex !== -1) {
    const replayFile = args[replayIndex + 1] || join(process.cwd(), ".ralph", "events.log")
    return { mode: "replay" as const, replayFile }
  }

  const iterations = parseInt(args.find(a => /^\d+$/.test(a)) ?? "", 10) || 10
  return { mode: "run" as const, iterations }
}

export const showHelp = () => {
  console.log(chalk.bold("ralph") + " - Autonomous AI iteration engine for Claude CLI\n")
  console.log(chalk.bold("Usage:"))
  console.log("  ralph [iterations]        Run ralph for specified iterations (default: 10)")
  console.log("  ralph init                Initialize .ralph directory with templates")
  console.log("  ralph --replay [file]     Replay events from log file")
  console.log("  ralph --help              Show this help message\n")
  console.log(chalk.bold("Examples:"))
  console.log("  ralph                     Run 10 iterations")
  console.log("  ralph 5                   Run 5 iterations")
  console.log("  ralph init                Create .ralph directory")
  console.log("  ralph --replay            Replay default log file")
  console.log("  ralph --replay custom.log Replay custom log file\n")
}

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
