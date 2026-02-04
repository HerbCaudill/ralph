/**
 * Playwright global teardown - cleans up the test workspace after test runs.
 *
 * This stops the bd daemon for the test workspace to prevent stale entries
 * from accumulating in the beads registry (~/.beads/registry.json).
 */
import { execSync } from "node:child_process"
import path from "node:path"

const TEST_WORKSPACE_DIR = path.join(import.meta.dirname, "test-workspace")

export default async function globalTeardown() {
  const quiet = process.env.PW_QUIET || process.env.CI

  try {
    // Stop the bd daemon for the test workspace to clean up registry entry
    execSync(`bd daemon stop "${TEST_WORKSPACE_DIR}"`, { stdio: "pipe" })

    if (!quiet) {
      console.log("[e2e-teardown] Stopped bd daemon for test workspace")
    }
  } catch {
    // Daemon may not be running, that's fine
    if (!quiet) {
      console.log("[e2e-teardown] No daemon running for test workspace (already stopped)")
    }
  }
}
