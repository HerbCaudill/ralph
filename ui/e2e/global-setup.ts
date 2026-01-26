/**
 * Playwright global setup - initializes the test workspace before test runs.
 *
 * This ensures E2E tests don't pollute the main repo's beads database.
 * The test workspace is recreated fresh for each test run.
 */
import { execSync } from "node:child_process"
import { rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs"
import path from "node:path"

const TEST_WORKSPACE_DIR = path.join(import.meta.dirname, "test-workspace")

/**
 * Attempts to remove a directory with retry logic.
 * Handles ENOTEMPTY and EBUSY errors that can occur when file handles
 * haven't been released yet (e.g., from bd daemon).
 */
async function removeDirectoryWithRetry(
  dirPath: string,
  maxRetries = 3,
  delayMs = 500,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      rmSync(dirPath, { recursive: true, force: true })
      return // Success
    } catch (error) {
      const isRetryableError =
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOTEMPTY" || error.code === "EBUSY")

      if (!isRetryableError || attempt === maxRetries) {
        throw error
      }

      // Wait before retrying to allow file handles to be released
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

export default async function globalSetup() {
  const quiet = process.env.PW_QUIET || process.env.CI

  // Stop any running bd daemon for the test workspace before cleanup
  // This helps release file handles that could cause ENOTEMPTY errors
  try {
    execSync(`bd daemon stop "${TEST_WORKSPACE_DIR}"`, { stdio: "pipe" })
  } catch {
    // Daemon may not be running, that's fine
  }

  // Remove existing test workspace to start fresh (with retry for file lock issues)
  if (existsSync(TEST_WORKSPACE_DIR)) {
    await removeDirectoryWithRetry(TEST_WORKSPACE_DIR)
  }

  // Create the test workspace directory
  mkdirSync(TEST_WORKSPACE_DIR, { recursive: true })

  // Initialize git repo (required for beads)
  execSync("git init", { cwd: TEST_WORKSPACE_DIR, stdio: "pipe" })
  execSync('git config user.email "test@example.com"', { cwd: TEST_WORKSPACE_DIR, stdio: "pipe" })
  execSync('git config user.name "Test User"', { cwd: TEST_WORKSPACE_DIR, stdio: "pipe" })

  // Create initial commit (required for beads)
  writeFileSync(path.join(TEST_WORKSPACE_DIR, "README.md"), "# Test Workspace\n")
  execSync("git add README.md", { cwd: TEST_WORKSPACE_DIR, stdio: "pipe" })
  execSync('git commit -m "Initial commit"', { cwd: TEST_WORKSPACE_DIR, stdio: "pipe" })

  // Ensure no stale .beads directory exists before init
  // This handles edge cases where the directory wasn't fully cleaned up
  const beadsDir = path.join(TEST_WORKSPACE_DIR, ".beads")
  if (existsSync(beadsDir)) {
    rmSync(beadsDir, { recursive: true, force: true })
  }

  // Initialize beads with a test-specific prefix
  execSync("bd init --prefix e2e-test --quiet --skip-hooks --skip-merge-driver", {
    cwd: TEST_WORKSPACE_DIR,
    stdio: "pipe",
  })

  if (!quiet) {
    console.log("[e2e-setup] Test workspace initialized at:", TEST_WORKSPACE_DIR)
  }
}
