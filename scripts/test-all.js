#!/usr/bin/env node
/**
 * Runs all tests across packages and reports summary statistics.
 * Tracks passed/failed counts per package and test type, plus total time.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

/** Test suite configuration */
const testSuites = [
  { name: "typecheck", type: "typecheck", filter: null, command: "typecheck" },
  { name: "shared", type: "vitest", filter: "@herbcaudill/ralph-shared", command: "test" },
  { name: "cli", type: "vitest", filter: "@herbcaudill/ralph", command: "test" },
  { name: "ui-vitest", type: "vitest", filter: "@herbcaudill/ralph-ui", command: "test" },
  { name: "ui-playwright", type: "playwright", filter: "@herbcaudill/ralph-ui", command: null },
]

/** Results storage */
const results = {
  suites: [],
  startTime: null,
  endTime: null,
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "")
}

/**
 * Parse vitest output to extract test counts.
 * Vitest outputs: "Tests  51 passed (51)" or "Tests  2 failed | 167 passed (169)"
 */
function parseVitestOutput(output) {
  const counts = { passed: 0, failed: 0, skipped: 0 }
  const clean = stripAnsi(output)

  // Match "Tests  X passed" or "Tests  X failed | Y passed"
  const testsMatch = clean.match(/Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?/i)
  if (testsMatch) {
    counts.failed = parseInt(testsMatch[1] || "0", 10)
    counts.passed = parseInt(testsMatch[2] || "0", 10)
    counts.skipped = parseInt(testsMatch[3] || "0", 10)
  }

  return counts
}

/**
 * Parse playwright output to extract test counts.
 * Playwright outputs: "  6 passed (30.2s)" or "  1 failed"
 */
function parsePlaywrightOutput(output) {
  const counts = { passed: 0, failed: 0, skipped: 0 }
  const clean = stripAnsi(output)

  const passedMatch = clean.match(/(\d+)\s+passed/i)
  const failedMatch = clean.match(/(\d+)\s+failed/i)
  const skippedMatch = clean.match(/(\d+)\s+skipped/i)

  if (passedMatch) counts.passed = parseInt(passedMatch[1], 10)
  if (failedMatch) counts.failed = parseInt(failedMatch[1], 10)
  if (skippedMatch) counts.skipped = parseInt(skippedMatch[1], 10)

  return counts
}

/**
 * Run a test suite and capture output.
 */
async function runTestSuite(suite) {
  const startTime = Date.now()

  return new Promise(resolve => {
    let args
    let env = { ...process.env }

    if (suite.type === "playwright") {
      // Run playwright via our script
      args = ["node", "scripts/playwright.js"]
    } else if (suite.type === "typecheck") {
      // Run typecheck across all packages
      args = ["pnpm", "typecheck"]
    } else {
      // Run vitest via pnpm filter
      args = ["pnpm", "--filter", suite.filter, suite.command]
    }

    const child = spawn(args[0], args.slice(1), {
      cwd: repoRoot,
      stdio: ["inherit", "pipe", "pipe"],
      env,
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", data => {
      const text = data.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr?.on("data", data => {
      const text = data.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.on("close", code => {
      const endTime = Date.now()
      const duration = endTime - startTime
      const output = stdout + stderr

      let counts = { passed: 0, failed: 0, skipped: 0 }
      if (suite.type === "playwright") {
        counts = parsePlaywrightOutput(output)
      } else if (suite.type === "vitest") {
        counts = parseVitestOutput(output)
      }
      // typecheck has no test counts, just pass/fail based on exit code

      resolve({
        name: suite.name,
        type: suite.type,
        exitCode: code,
        duration,
        ...counts,
      })
    })
  })
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}

/**
 * Print summary report.
 */
function printSummary() {
  const totalDuration = results.endTime - results.startTime

  console.log("\n" + "═".repeat(60))
  console.log("TEST SUMMARY")
  console.log("═".repeat(60))

  // Per-package results
  console.log("\nBy Package:")
  console.log("─".repeat(60))
  console.log(
    `${"Package".padEnd(20)} ${"Type".padEnd(12)} ${"Passed".padStart(8)} ${"Failed".padStart(8)} ${"Time".padStart(10)}`,
  )
  console.log("─".repeat(60))

  for (const suite of results.suites) {
    const status = suite.exitCode === 0 ? "✓" : "✗"
    const passed = suite.type === "typecheck" ? "-" : String(suite.passed)
    const failed = suite.type === "typecheck" ? "-" : String(suite.failed)
    console.log(
      `${status} ${suite.name.padEnd(18)} ${suite.type.padEnd(12)} ${passed.padStart(8)} ${failed.padStart(8)} ${formatDuration(suite.duration).padStart(10)}`,
    )
  }

  // By type totals
  console.log("\nBy Type:")
  console.log("─".repeat(60))

  const byType = {}
  for (const suite of results.suites) {
    if (!byType[suite.type]) {
      byType[suite.type] = { passed: 0, failed: 0, duration: 0 }
    }
    byType[suite.type].passed += suite.passed
    byType[suite.type].failed += suite.failed
    byType[suite.type].duration += suite.duration
  }

  for (const [type, counts] of Object.entries(byType)) {
    if (type === "typecheck") {
      console.log(`  ${type.padEnd(18)} ${formatDuration(counts.duration).padStart(10)}`)
    } else {
      console.log(
        `  ${type.padEnd(18)} ${String(counts.passed).padStart(8)} passed  ${String(counts.failed).padStart(8)} failed  ${formatDuration(counts.duration).padStart(10)}`,
      )
    }
  }

  // Grand totals
  const totalPassed = results.suites.reduce((sum, s) => sum + s.passed, 0)
  const totalFailed = results.suites.reduce((sum, s) => sum + s.failed, 0)
  const allPassed = results.suites.every(s => s.exitCode === 0)

  console.log("\n" + "═".repeat(60))
  console.log(
    `TOTAL: ${totalPassed} passed, ${totalFailed} failed in ${formatDuration(totalDuration)}`,
  )
  console.log("═".repeat(60))

  return allPassed ? 0 : 1
}

async function main() {
  results.startTime = Date.now()

  console.log("Running all tests...\n")

  for (const suite of testSuites) {
    console.log(`\n${"─".repeat(60)}`)
    console.log(`Running ${suite.name} (${suite.type})...`)
    console.log("─".repeat(60) + "\n")

    const result = await runTestSuite(suite)
    results.suites.push(result)

    // Stop on first failure unless CI mode
    if (result.exitCode !== 0 && !process.env.CI) {
      console.log(`\n⚠ ${suite.name} failed, stopping early.`)
      break
    }
  }

  results.endTime = Date.now()
  const exitCode = printSummary()
  process.exit(exitCode)
}

main().catch(err => {
  console.error("Error:", err.message)
  process.exit(1)
})
