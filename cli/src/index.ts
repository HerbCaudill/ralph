import { program } from "./cli.js"

/**
 * Parse and execute the CLI program with command-line arguments.
 */
export const run = () => {
  program.parse(process.argv)
}

/**
 * Run if called directly as a script.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
