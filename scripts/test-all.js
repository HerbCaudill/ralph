#!/usr/bin/env node
/**
 * Runs all tests across packages and reports summary statistics.
 * Tracks passed/failed counts per package and test type, plus total time.
 *
 * Usage:
 *   node scripts/test-all.js           # Run all tests
 *   node scripts/test-all.js --changed # Run only tests affected by uncommitted changes
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

/** Parse CLI flags */
const changedMode = process.argv.includes("--changed")

/** ANSI style helpers */
const style = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
}

/** Test suite configuration */
const testSuites = [
  { name: "typecheck", type: "typecheck" },
  { name: "shared", type: "vitest", dir: "shared" },
  { name: "cli", type: "vitest", dir: "cli" },
  { name: "ui-vitest", type: "vitest", dir: "ui" },
  { name: "ui-playwright", type: "playwright" },
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
 * Parse vitest JSON output to extract test counts.
 * With --reporter=json, vitest outputs a JSON object to stdout.
 */
function parseVitestOutput(output) {
  const counts = { passed: 0, failed: 0, skipped: 0 }

  // Find the JSON object in the output (it starts with { and ends with })
  const jsonMatch = output.match(/\{[\s\S]*"numPassedTests"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      counts.passed = json.numPassedTests || 0
      counts.failed = json.numFailedTests || 0
      counts.skipped = json.numPendingTests || 0
      return counts
    } catch {
      // Fall through to text parsing
    }
  }

  // Fall back to text parsing if JSON fails
  const clean = stripAnsi(output)
  const testsMatch = clean.match(/Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed/i)
  if (testsMatch) {
    counts.failed = parseInt(testsMatch[1] || "0", 10)
    counts.passed = parseInt(testsMatch[2] || "0", 10)
  }
  const skippedMatch = clean.match(/(\d+)\s+skipped/i)
  if (skippedMatch) {
    counts.skipped = parseInt(skippedMatch[1], 10)
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
 * Run a test suite and capture output silently.
 * Always buffers output, only shows it on failure.
 */
async function runTestSuite(suite) {
  const startTime = Date.now()

  return new Promise(resolve => {
    let args
    let cwd = repoRoot
    const env = { ...process.env, NO_COLOR: "1" }

    if (suite.type === "playwright") {
      args = ["node", "scripts/playwright.js"]
    } else if (suite.type === "typecheck") {
      args = ["pnpm", "-r", "--parallel", "typecheck"]
    } else if (suite.type === "vitest") {
      // Run vitest directly in the package directory with JSON reporter
      args = ["pnpm", "vitest", "run", "--reporter=json"]
      if (changedMode) {
        args.push("--changed")
      }
      cwd = path.join(repoRoot, suite.dir)
    }

    const child = spawn(args[0], args.slice(1), {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env,
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", data => {
      stdout += data.toString()
    })

    child.stderr?.on("data", data => {
      stderr += data.toString()
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
 * Format duration in seconds.
 */
function formatDuration(ms) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * Print summary totals.
 */
function printSummary() {
  const totalDuration = results.endTime - results.startTime
  const totalPassed = results.suites.reduce((sum, s) => sum + s.passed, 0)
  const totalFailed = results.suites.reduce((sum, s) => sum + s.failed, 0)
  const allPassed = results.suites.every(s => s.exitCode === 0)

  const passedStr = style.green(`${totalPassed} passed`)
  const failedStr =
    totalFailed > 0 ? style.red(`${totalFailed} failed`) : style.dim(`${totalFailed} failed`)
  const durationStr = style.yellow(`(${formatDuration(totalDuration)})`)

  console.log(`\n  ${style.bold("Total")} ${passedStr}, ${failedStr} ${durationStr}`)

  return allPassed ? 0 : 1
}

/**
 * Print a single result line with spinner or status.
 */
function printResultLine(result) {
  const status = result.exitCode === 0 ? style.green("✓") : style.red("✗")
  const name = style.bold(result.name)
  const durationStr = style.yellow(`(${formatDuration(result.duration)})`)

  if (result.type === "typecheck") {
    console.log(`  ${status} ${name} ${durationStr}`)
  } else {
    const passedStr = style.green(`${result.passed} passed`)
    const failedStr =
      result.failed > 0 ?
        style.red(`${result.failed} failed`)
      : style.dim(`${result.failed} failed`)
    console.log(`  ${status} ${name} ${passedStr}, ${failedStr} ${durationStr}`)
  }
}

async function main() {
  console.clear()
  results.startTime = Date.now()

  if (changedMode) {
    console.log(style.bold("\nRunning all tests (vitest: --changed)\n"))
  } else {
    console.log(style.bold("\nRunning all tests\n"))
  }

  // Phase 1: Run typecheck (must pass before tests make sense)
  const typecheckSuite = testSuites.find(s => s.type === "typecheck")
  if (typecheckSuite) {
    process.stdout.write(`  ◌ ${typecheckSuite.name}...`)
    const result = await runTestSuite(typecheckSuite)
    results.suites.push(result)
    // Clear the "running" line and print result
    process.stdout.write("\r\x1b[K")
    printResultLine(result)

    if (result.exitCode !== 0) {
      console.log(`\n⚠ ${typecheckSuite.name} failed. Output:\n`)
      console.log(result.output)
      results.endTime = Date.now()
      process.exit(printSummary())
    }
  }

  // Phase 2: Run all vitest suites sequentially (parallel causes esbuild EPIPE crashes)
  const vitestSuites = testSuites.filter(s => s.type === "vitest")
  for (const suite of vitestSuites) {
    process.stdout.write(`  ◌ ${suite.name}...`)
    const result = await runTestSuite(suite)
    results.suites.push(result)
    process.stdout.write("\r\x1b[K")
    printResultLine(result)

    if (result.exitCode !== 0) {
      console.log(`\n⚠ ${suite.name} failed. Output:\n`)
      console.log(result.output)
      results.endTime = Date.now()
      process.exit(printSummary())
    }
  }

  // Phase 3: Run playwright (needs dev server isolation)
  const playwrightSuite = testSuites.find(s => s.type === "playwright")
  if (playwrightSuite) {
    process.stdout.write(`  ◌ ${playwrightSuite.name}...`)
    const result = await runTestSuite(playwrightSuite)
    results.suites.push(result)
    process.stdout.write("\r\x1b[K")
    printResultLine(result)

    if (result.exitCode !== 0) {
      console.log(`\n⚠ ${playwrightSuite.name} failed. Output:\n`)
      console.log(result.output)
      results.endTime = Date.now()
      process.exit(printSummary())
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
