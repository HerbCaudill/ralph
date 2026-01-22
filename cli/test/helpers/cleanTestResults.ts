import { existsSync, rmSync, readdirSync } from "fs"
import { join } from "path"

/**
 * Cleans the .test-results directory.
 */
export const cleanTestResults = () => {
  const resultsDir = join(__dirname, "../../.test-results")
  if (existsSync(resultsDir)) {
    // Remove all .txt files in the directory
    const files = readdirSync(resultsDir)
    for (const file of files) {
      if (file.endsWith(".txt")) {
        rmSync(join(resultsDir, file))
      }
    }
  }
}
