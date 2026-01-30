import { join } from "path"
import { findMaxLogNumber } from "./findMaxLogNumber.js"

/**
 * Get the path to the most recent (highest numbered) log file in the .ralph directory.
 * Returns undefined if no event logs exist.
 */
export const getLatestLogFile = (): string | undefined => {
  const maxNumber = findMaxLogNumber()
  if (maxNumber === 0) {
    return undefined
  }

  const ralphDir = join(process.cwd(), ".ralph")
  return join(ralphDir, `events-${maxNumber}.jsonl`)
}
