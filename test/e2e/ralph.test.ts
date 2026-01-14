import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest"
import { join } from "path"
import { existsSync, rmSync, cpSync, mkdirSync, readFileSync } from "fs"
import { runRalph, cleanTestResults } from "../helpers/runRalph.js"

const FIXTURES_DIR = join(__dirname, "../fixtures")
const TEST_WORKSPACE = join(__dirname, "../../.test-workspace")

/**
 * E2E tests for ralph CLI
 *
 * These tests run the actual ralph binary against test fixtures.
 * Note: These tests are skipped by default because they require:
 * 1. A working `claude` CLI in PATH
 * 2. Claude CLI to be configured with API key
 * 3. Network access to Claude API
 *
 * To run these tests: pnpm test:e2e
 */
describe("Ralph E2E Tests", () => {
  beforeAll(() => {
    // Clean test results directory at start of test suite
    cleanTestResults()
  })

  beforeEach(() => {
    // Clean up test workspace
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true })
    }
    mkdirSync(TEST_WORKSPACE, { recursive: true })
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true })
    }
  })

  describe("ralph init", () => {
    it("creates .ralph directory with required files in empty project", async () => {
      const fixturePath = join(FIXTURES_DIR, "empty")
      const workspacePath = join(TEST_WORKSPACE, "empty-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["init"],
        cwd: workspacePath,
        timeout: 10000,
        testName: "ralph-init-empty-project",
      })

      expect(result.exitCode).toBe(0)
      expect(existsSync(join(workspacePath, ".ralph/prompt.md"))).toBe(true)
      expect(existsSync(join(workspacePath, ".ralph/todo.md"))).toBe(true)
    })

    it("creates missing files in incomplete setup", async () => {
      const fixturePath = join(FIXTURES_DIR, "incomplete-setup")
      const workspacePath = join(TEST_WORKSPACE, "incomplete-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["init"],
        cwd: workspacePath,
        timeout: 10000,
        testName: "ralph-init-incomplete-setup",
      })

      expect(result.exitCode).toBe(0)
      // Should preserve existing prompt.md
      const promptContent = readFileSync(join(workspacePath, ".ralph/prompt.md"), "utf-8")
      expect(promptContent).toContain("only has prompt.md")
      // Should create missing files
      expect(existsSync(join(workspacePath, ".ralph/todo.md"))).toBe(true)
    })

    it("does not overwrite existing complete setup", async () => {
      const fixturePath = join(FIXTURES_DIR, "valid-setup")
      const workspacePath = join(TEST_WORKSPACE, "valid-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const originalPrompt = readFileSync(join(workspacePath, ".ralph/prompt.md"), "utf-8")

      const result = await runRalph({
        args: ["init"],
        cwd: workspacePath,
        timeout: 10000,
        testName: "ralph-init-complete-setup",
      })

      expect(result.exitCode).toBe(0)
      const currentPrompt = readFileSync(join(workspacePath, ".ralph/prompt.md"), "utf-8")
      expect(currentPrompt).toBe(originalPrompt)
    })
  })

  describe("missing files detection", () => {
    it("exits with error when required files are missing in non-TTY", async () => {
      const fixturePath = join(FIXTURES_DIR, "empty")
      const workspacePath = join(TEST_WORKSPACE, "missing-files-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["1"],
        cwd: workspacePath,
        timeout: 5000,
        env: { CI: "true" }, // Simulate non-TTY
        testName: "ralph-missing-files-error",
      })

      expect(result.exitCode).toBe(1)
      expect(result.stdout || result.stderr).toContain("Missing required files")
    })
  })

  describe("iteration execution", () => {
    it("runs one iteration successfully", async () => {
      const fixturePath = join(FIXTURES_DIR, "realistic-workflow")
      const workspacePath = join(TEST_WORKSPACE, "iteration-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["1"],
        cwd: workspacePath,
        timeout: 120000, // Claude API calls can take time
        testName: "ralph-one-iteration",
      })

      // May exit with 0 (if COMPLETE) or continue (normal iteration end)
      expect(result.exitCode === 0 || result.exitCode === null).toBe(true)
      expect(existsSync(join(workspacePath, ".ralph/events.log"))).toBe(true)
    }, 120000)

    it("runs multiple iterations", async () => {
      const fixturePath = join(FIXTURES_DIR, "realistic-workflow")
      const workspacePath = join(TEST_WORKSPACE, "multi-iteration-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["3"],
        cwd: workspacePath,
        timeout: 180000, // 3 minutes for multiple iterations
        testName: "ralph-three-iterations",
      })

      expect(existsSync(join(workspacePath, ".ralph/events.log"))).toBe(true)

      // Check if todo.md was modified
      const todoContent = readFileSync(join(workspacePath, ".ralph/todo.md"), "utf-8")
      // At least one task should be marked complete
      expect(todoContent).toMatch(/- \[x\]/)
    }, 180000)

    it("stops when COMPLETE promise is detected", async () => {
      const fixturePath = join(FIXTURES_DIR, "realistic-workflow")
      const workspacePath = join(TEST_WORKSPACE, "complete-test")
      cpSync(fixturePath, workspacePath, { recursive: true })

      const result = await runRalph({
        args: ["10"], // Request many iterations
        cwd: workspacePath,
        timeout: 180000,
        testName: "ralph-complete-detection",
      })

      // Should exit with 0 when COMPLETE is detected
      expect(result.exitCode).toBe(0)
    }, 180000)
  })
})

/**
 * Unit-style E2E tests that don't require Claude CLI
 * These verify the CLI interface without actually running iterations
 */
describe("Ralph CLI interface", () => {
  beforeAll(() => {
    // Clean test results directory at start of test suite
    cleanTestResults()
  })

  it("shows error for invalid command", async () => {
    const result = await runRalph({
      args: ["invalid-command"],
      timeout: 2000,
      testName: "ralph-invalid-command",
    })

    expect(result.exitCode).not.toBe(0)
  })

  it("accepts numeric iteration count", async () => {
    // This will fail due to missing files, but should parse the argument
    const result = await runRalph({
      args: ["5"],
      cwd: TEST_WORKSPACE,
      timeout: 2000,
      testName: "ralph-numeric-argument",
    })

    // Should not be a parsing error
    expect(result.stderr).not.toContain("invalid")
  })

  it("init command is recognized", async () => {
    const workspacePath = join(TEST_WORKSPACE, "cli-init-test")
    mkdirSync(workspacePath, { recursive: true })

    const result = await runRalph({
      args: ["init"],
      cwd: workspacePath,
      timeout: 2000,
      testName: "ralph-init-recognized",
    })

    // Should not error on the command itself
    expect(result.exitCode === 0 || existsSync(join(workspacePath, ".ralph"))).toBe(true)
  })
})
