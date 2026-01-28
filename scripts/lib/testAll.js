#!/usr/bin/env node
/**
 * Generic test runner that executes suites sequentially, parses output,
 * bails on first failure, and prints a concise summary.
 *
 * Loads configuration from `test-all.config.js` in the working directory.
 * The config should export a function that receives CLI flags and returns
 * { suites, options }.
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** ANSI style helpers */
const style = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
}

/** Strip ANSI escape codes from a string. */
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

/** Built-in output parsers, keyed by name. */
const parsers = {
  vitest: parseVitestOutput,
  playwright: parsePlaywrightOutput,
}

/**
 * Run a single command and capture its output.
 *
 * Returns { exitCode, duration, output }.
 */
function runCommand(
  /** The command and arguments to run, e.g. "pnpm vitest run" or ["pnpm", "vitest", "run"] */
  args,
  /** Options: cwd, env overrides */
  { cwd, env } = {},
) {
  const startTime = Date.now()
  return new Promise(resolve => {
    if (typeof args === "string") args = args.split(/\s+/)
    const child = spawn(args[0], args.slice(1), {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", ...env },
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
      resolve({
        exitCode: code,
        duration: Date.now() - startTime,
        output: stdout + stderr,
      })
    })
  })
}

/** Format milliseconds as a human-readable duration. */
function formatDuration(ms) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/** Print a single result line. */
function printResultLine(result) {
  const status = result.exitCode === 0 ? style.green("✓") : style.red("✗")
  const name = style.bold(result.name)
  const durationStr = style.yellow(`(${formatDuration(result.duration)})`)

  if (result.type == null) {
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

/** Print summary totals and return exit code (0 = all passed). */
function printSummary(suiteResults, totalDuration) {
  const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0)
  const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0)
  const allPassed = suiteResults.every(s => s.exitCode === 0)

  const passedStr = style.green(`${totalPassed} passed`)
  const failedStr =
    totalFailed > 0 ? style.red(`${totalFailed} failed`) : style.dim(`${totalFailed} failed`)
  const durationStr = style.yellow(`(${formatDuration(totalDuration)})`)

  console.log(`\n  ${style.bold("Total")} ${passedStr}, ${failedStr} ${durationStr}`)

  return allPassed ? 0 : 1
}

/**
 * Run test suites sequentially, bail on first failure, print concise summary.
 *
 * Each suite in the array should have:
 * - name: display name
 * - command: string or array, e.g. "pnpm vitest run" or ["pnpm", "vitest", "run"]
 * - type: "vitest" | "playwright" | null (determines output parser; null = no test counts)
 * - dir: subdirectory to run in, resolved relative to options.cwd (optional)
 *
 * Options:
 * - cwd: root working directory; suite `dir` values are resolved relative to this
 * - title: header text (default: "Running all tests")
 * - clear: clear the terminal before running (default: true)
 */
async function testAll(
  /** Array of suite definitions */
  suites,
  /** Options */
  { cwd = process.cwd(), title = "Running all tests", clear = true } = {},
) {
  if (clear) console.clear()
  const startTime = Date.now()
  console.log(style.bold(`\n${title}\n`))

  const completed = []

  for (const suite of suites) {
    process.stdout.write(`  ◌ ${suite.name}...`)

    const suiteCwd = suite.dir ? path.join(cwd, suite.dir) : cwd
    const result = await runCommand(suite.command, { cwd: suiteCwd })
    const parse = suite.type ? (parsers[suite.type] ?? suite.type) : null
    const counts = parse ? parse(result.output) : { passed: 0, failed: 0, skipped: 0 }

    const suiteResult = {
      name: suite.name,
      type: suite.type,
      ...result,
      ...counts,
    }

    completed.push(suiteResult)

    // Clear spinner line and print result
    process.stdout.write("\r\x1b[K")
    printResultLine(suiteResult)

    if (result.exitCode !== 0) {
      console.log(`\n⚠ ${suite.name} failed. Output:\n`)
      console.log(result.output)
      break
    }
  }

  const totalDuration = Date.now() - startTime
  const exitCode = printSummary(completed, totalDuration)
  process.exit(exitCode)
}

// ---- CLI entry point ----

const configPath = path.join(process.cwd(), "test-all.config.js")
const changed = process.argv.includes("--changed")

let config
try {
  const mod = await import(pathToFileURL(configPath).href)
  config = mod.default
} catch (err) {
  if (err.code === "ERR_MODULE_NOT_FOUND") {
    console.error(`No test-all.config.js found in ${process.cwd()}`)
    process.exit(1)
  }
  throw err
}

const suites = config.suites.map(suite => {
  if (suite.type !== "vitest") return suite
  // Vitest suites get --reporter=json for structured output parsing,
  // and --changed when that flag is passed to the CLI.
  // Uses -- separator so pnpm --filter forwards args to the script.
  const extras = ["--", "--reporter=json", ...(changed ? ["--changed"] : [])]
  const cmd =
    typeof suite.command === "string" ?
      `${suite.command} ${extras.join(" ")}`
    : [...suite.command, ...extras]
  return { ...suite, command: cmd }
})

const title =
  changed ?
    `${config.options?.title ?? "Running all tests"} (vitest: --changed)`
  : config.options?.title

await testAll(suites, { ...config.options, title })
