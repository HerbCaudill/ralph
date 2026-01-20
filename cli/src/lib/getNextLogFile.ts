import { readdirSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const EVENT_LOG_PATTERN = /^events-(\d+)\.jsonl$/

/**
 * Find the highest numbered event log file that exists in the .ralph directory.
 * Returns 0 if no event logs exist.
 */
const findMaxLogNumber = (): number => {
  const ralphDir = join(process.cwd(), ".ralph")

  if (!existsSync(ralphDir)) {
    return 0
  }

  const files = readdirSync(ralphDir)
  let maxNumber = 0

  for (const file of files) {
    const match = file.match(EVENT_LOG_PATTERN)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNumber) {
        maxNumber = num
      }
    }
  }

  return maxNumber
}

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
