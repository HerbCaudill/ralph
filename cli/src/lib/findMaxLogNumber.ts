import { readdirSync, existsSync } from "fs"
import { join } from "path"

const EVENT_LOG_PATTERN = /^events-(\d+)\.jsonl$/

/**
 * Find the highest numbered event log file that exists in the .ralph directory.
 * Returns 0 if no event logs exist.
 */
export const findMaxLogNumber = (): number => {
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
