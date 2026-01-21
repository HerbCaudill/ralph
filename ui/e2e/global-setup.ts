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

export default async function globalSetup() {
  console.log("[e2e-setup] Initializing test workspace...")

  // Remove existing test workspace to start fresh
  if (existsSync(TEST_WORKSPACE_DIR)) {
    rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true })
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

  // Initialize beads with a test-specific prefix
  execSync("bd init --prefix e2e-test --quiet --skip-hooks --skip-merge-driver", {
    cwd: TEST_WORKSPACE_DIR,
    stdio: "pipe",
  })

  console.log("[e2e-setup] Test workspace initialized at:", TEST_WORKSPACE_DIR)
}
