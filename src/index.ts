import { program } from "./cli.js"

export const run = () => {
  program.parse(process.argv)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
