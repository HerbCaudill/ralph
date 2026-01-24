#!/usr/bin/env node
/**
 * Runs all tests across packages and reports summary statistics.
 * Tracks passed/failed counts per package and test type, plus total time.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Table from "cli-table3"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

/** ANSI style helpers */
const style = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  blue: s => `\x1b[34m${s}\x1b[0m`,
  boldBlue: s => `\x1b[1;34m${s}\x1b[0m`,
}

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
  const testsMatch = clean.match(
    /Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?/i,
  )
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
 * If silent is true, buffer output instead of streaming it.
 */
async function runTestSuite(suite, { silent = false } = {}) {
  const startTime = Date.now()

  return new Promise(resolve => {
    let args
    let env = { ...process.env }

    if (suite.type === "playwright") {
      // Run playwright via our script
      args = ["node", "scripts/playwright.js"]
    } else if (suite.type === "typecheck") {
      // Run typecheck across all packages in parallel
      args = ["pnpm", "-r", "--parallel", "typecheck"]
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
      if (!silent) process.stdout.write(text)
    })

    child.stderr?.on("data", data => {
      const text = data.toString()
      stderr += text
      if (!silent) process.stderr.write(text)
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
        output,
        ...counts,
      })
    })
  })
}

/**
 * Print a heading in a box.
 */
function printBoxHeading(text) {
  const width = text.length + 2
  console.log(style.boldBlue(`\n┌${"─".repeat(width)}┐`))
  console.log(style.boldBlue(`│ ${text} │`))
  console.log(style.boldBlue(`└${"─".repeat(width)}┘\n`))
}

/**
 * Format duration in seconds.
 */
function formatDuration(ms) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * Print summary report using cli-table3.
 */
function printSummary() {
  const totalDuration = results.endTime - results.startTime

  console.log("\n")

  // Per-package results table (no borders)
  const packageTable = new Table({
    head: ["", "Package", "Type", "Passed", "Failed", "Time"].map(h => style.bold(h)),
    colAligns: ["left", "left", "left", "right", "right", "right"],
    style: { head: [], border: [], "padding-left": 1, "padding-right": 1 },
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "",
    },
  })

  // Grand totals
  const totalPassed = results.suites.reduce((sum, s) => sum + s.passed, 0)
  const totalFailed = results.suites.reduce((sum, s) => sum + s.failed, 0)
  const allPassed = results.suites.every(s => s.exitCode === 0)

  for (const suite of results.suites) {
    const status = suite.exitCode === 0 ? "✓" : "✗"
    const passed = suite.type === "typecheck" ? "-" : String(suite.passed)
    const failed = suite.type === "typecheck" ? "-" : String(suite.failed)
    packageTable.push([
      status,
      suite.name,
      suite.type,
      passed,
      failed,
      formatDuration(suite.duration),
    ])
  }

  // Add total row (bold)
  packageTable.push(
    ["", "Total", "", String(totalPassed), String(totalFailed), formatDuration(totalDuration)].map(
      c => style.bold(c),
    ),
  )

  console.log(packageTable.toString())

  return allPassed ? 0 : 1
}

async function main() {
  console.clear()
  results.startTime = Date.now()

  console.log("Running all tests...\n")

  // Phase 1: Run typecheck (must pass before tests make sense)
  const typecheckSuite = testSuites.find(s => s.type === "typecheck")
  if (typecheckSuite) {
    printBoxHeading(`Running ${typecheckSuite.name} (${typecheckSuite.type})`)
    const result = await runTestSuite(typecheckSuite)
    results.suites.push(result)
    if (result.exitCode !== 0 && !process.env.CI) {
      console.log(`\n⚠ ${typecheckSuite.name} failed, stopping early.`)
      results.endTime = Date.now()
      process.exit(printSummary())
    }
  }

  // Phase 2: Run all vitest suites in parallel
  const vitestSuites = testSuites.filter(s => s.type === "vitest")
  if (vitestSuites.length > 0) {
    printBoxHeading(`Running vitest suites in parallel (${vitestSuites.map(s => s.name).join(", ")})`)

    const vitestResults = await Promise.all(vitestSuites.map(s => runTestSuite(s, { silent: true })))

    // Print results in order
    for (const result of vitestResults) {
      const status = result.exitCode === 0 ? "✓" : "✗"
      console.log(`${status} ${result.name}: ${result.passed} passed, ${result.failed} failed (${formatDuration(result.duration)})`)
      results.suites.push(result)
    }

    // Check for failures
    const failed = vitestResults.find(r => r.exitCode !== 0)
    if (failed && !process.env.CI) {
      console.log(`\n⚠ ${failed.name} failed. Output:`)
      console.log(failed.output)
      console.log("Stopping early.")
      results.endTime = Date.now()
      process.exit(printSummary())
    }
  }

  // Phase 3: Run playwright (needs dev server isolation)
  const playwrightSuite = testSuites.find(s => s.type === "playwright")
  if (playwrightSuite) {
    printBoxHeading(`Running ${playwrightSuite.name} (${playwrightSuite.type})`)
    const result = await runTestSuite(playwrightSuite)
    results.suites.push(result)
  }

  results.endTime = Date.now()
  const exitCode = printSummary()
  process.exit(exitCode)
}

main().catch(err => {
  console.error("Error:", err.message)
  process.exit(1)
})
