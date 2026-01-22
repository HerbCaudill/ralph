import { existsSync, mkdirSync } from "fs"
import { join } from "path"
import { findMaxLogNumber } from "./findMaxLogNumber.js"

/**
 * Get the path to the next sequential log file in the .ralph directory.
 * Files are named events-1.jsonl, events-2.jsonl, etc.
 * Returns the path for the next available number (highest existing + 1).
 */
export const getNextLogFile = (): string => {
  const ralphDir = join(process.cwd(), ".ralph")

  // Ensure .ralph directory exists
  if (!existsSync(ralphDir)) {
    mkdirSync(ralphDir, { recursive: true })
  }

  const maxNumber = findMaxLogNumber()
  return join(ralphDir, `events-${maxNumber + 1}.jsonl`)
}
