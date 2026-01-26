#!/usr/bin/env node
/**
 * Benchmark test runner CPU usage across different configurations.
 * Samples CPU/memory at intervals and generates comparison reports.
 *
 * Usage:
 *   node scripts/benchmark-tests.js                    # Run all benchmarks
 *   node scripts/benchmark-tests.js --config workers   # Run worker count comparison
 *   node scripts/benchmark-tests.js --suite ui         # Only benchmark UI tests
 *   node scripts/benchmark-tests.js --dry-run          # Show what would run
 */
import { spawn, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const resultsDir = path.join(repoRoot, "benchmark-results")

/** ANSI style helpers */
const style = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    config: "all", // all, workers, pools, browsers
    suite: "all", // all, ui, cli, shared, playwright
    dryRun: false,
    sampleInterval: 500, // ms between CPU samples
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && args[i + 1]) {
      options.config = args[++i]
    } else if (args[i] === "--suite" && args[i + 1]) {
      options.suite = args[++i]
    } else if (args[i] === "--dry-run") {
      options.dryRun = true
    } else if (args[i] === "--interval" && args[i + 1]) {
      options.sampleInterval = parseInt(args[++i], 10)
    }
  }

  return options
}

/**
 * Get current CPU usage percentages from top.
 */
function sampleCpu() {
  try {
    const output = execSync("top -l 1 -n 0 -stats cpu", {
      encoding: "utf8",
      timeout: 5000,
    })

    const cpuLine = output.split("\n").find(l => l.includes("CPU usage"))
    if (!cpuLine) return null

    const userMatch = cpuLine.match(/([\d.]+)%\s*user/)
    const sysMatch = cpuLine.match(/([\d.]+)%\s*sys/)
    const idleMatch = cpuLine.match(/([\d.]+)%\s*idle/)

    const loadLine = output.split("\n").find(l => l.includes("Load Avg"))
    let load1 = 0
    if (loadLine) {
      const loadMatch = loadLine.match(/Load Avg:\s*([\d.]+)/)
      if (loadMatch) load1 = parseFloat(loadMatch[1])
    }

    return {
      user: userMatch ? parseFloat(userMatch[1]) : 0,
      sys: sysMatch ? parseFloat(sysMatch[1]) : 0,
      idle: idleMatch ? parseFloat(idleMatch[1]) : 0,
      load: load1,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Run a test command and sample CPU during execution.
 */
async function runBenchmark(name, cmd, cwd, sampleInterval) {
  const samples = []
  const startTime = Date.now()

  return new Promise(resolve => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", data => {
      stdout += data.toString()
    })
    child.stderr?.on("data", data => {
      stderr += data.toString()
    })

    // Sample CPU at intervals
    const sampleTimer = setInterval(() => {
      const sample = sampleCpu()
      if (sample) samples.push(sample)
    }, sampleInterval)

    // Take initial sample
    const initial = sampleCpu()
    if (initial) samples.push(initial)

    child.on("close", code => {
      clearInterval(sampleTimer)

      // Take final sample
      const final = sampleCpu()
      if (final) samples.push(final)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Calculate statistics
      const stats = calculateStats(samples)

      resolve({
        name,
        cmd: cmd.join(" "),
        exitCode: code,
        duration,
        samples,
        stats,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * Calculate statistics from CPU samples.
 */
function calculateStats(samples) {
  if (samples.length === 0) {
    return { avgUser: 0, avgSys: 0, avgTotal: 0, maxTotal: 0, avgLoad: 0, maxLoad: 0 }
  }

  const users = samples.map(s => s.user)
  const syss = samples.map(s => s.sys)
  const totals = samples.map(s => s.user + s.sys)
  const loads = samples.map(s => s.load)

  return {
    avgUser: average(users),
    avgSys: average(syss),
    avgTotal: average(totals),
    maxTotal: Math.max(...totals),
    avgLoad: average(loads),
    maxLoad: Math.max(...loads),
    sampleCount: samples.length,
  }
}

/**
 * Calculate average of an array.
 */
function average(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms) {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

/**
 * Define benchmark configurations to test.
 */
function getBenchmarkConfigs(configType, suiteType) {
  const configs = []

  // UI vitest configurations
  if (suiteType === "all" || suiteType === "ui") {
    if (configType === "all" || configType === "workers") {
      // Test different worker counts
      for (const workers of [1, 2, 4, 8]) {
        configs.push({
          name: `ui-vitest-${workers}workers`,
          cmd: [
            "pnpm",
            "vitest",
            "run",
            "--project=unit",
            "--project=server",
            `--pool-options.threads.maxThreads=${workers}`,
          ],
          cwd: path.join(repoRoot, "ui"),
        })
      }
    }

    if (configType === "all" || configType === "pools") {
      // Test different pool types
      configs.push({
        name: "ui-vitest-threads",
        cmd: ["pnpm", "vitest", "run", "--project=unit", "--project=server", "--pool=threads"],
        cwd: path.join(repoRoot, "ui"),
      })
      configs.push({
        name: "ui-vitest-forks",
        cmd: ["pnpm", "vitest", "run", "--project=unit", "--project=server", "--pool=forks"],
        cwd: path.join(repoRoot, "ui"),
      })
    }

    if (configType === "all" || configType === "browsers") {
      // Test storybook browser tests with different settings
      configs.push({
        name: "ui-storybook-default",
        cmd: ["pnpm", "vitest", "run", "--project=storybook"],
        cwd: path.join(repoRoot, "ui"),
      })
    }
  }

  // CLI vitest configurations
  if (suiteType === "all" || suiteType === "cli") {
    if (configType === "all" || configType === "workers") {
      for (const workers of [1, 2, 4]) {
        configs.push({
          name: `cli-vitest-${workers}workers`,
          cmd: ["pnpm", "vitest", "run", `--pool-options.threads.maxThreads=${workers}`],
          cwd: path.join(repoRoot, "cli"),
        })
      }
    }
  }

  // Playwright configurations
  if (suiteType === "all" || suiteType === "playwright") {
    if (configType === "all" || configType === "workers") {
      for (const workers of [1, 2, 4]) {
        configs.push({
          name: `playwright-${workers}workers`,
          cmd: ["node", "scripts/playwright.js", `--workers=${workers}`],
          cwd: repoRoot,
        })
      }
    }
  }

  return configs
}

/**
 * Print a comparison table of results.
 */
function printComparison(results) {
  console.log("\n" + style.bold("Benchmark Results") + "\n")
  console.log(
    "┌" +
      "─".repeat(30) +
      "┬" +
      "─".repeat(10) +
      "┬" +
      "─".repeat(12) +
      "┬" +
      "─".repeat(12) +
      "┬" +
      "─".repeat(10) +
      "┐",
  )
  console.log(
    "│ " +
      style.bold("Config".padEnd(28)) +
      " │ " +
      style.bold("Duration".padEnd(8)) +
      " │ " +
      style.bold("Avg CPU %".padEnd(10)) +
      " │ " +
      style.bold("Max CPU %".padEnd(10)) +
      " │ " +
      style.bold("Avg Load".padEnd(8)) +
      " │",
  )
  console.log(
    "├" +
      "─".repeat(30) +
      "┼" +
      "─".repeat(10) +
      "┼" +
      "─".repeat(12) +
      "┼" +
      "─".repeat(12) +
      "┼" +
      "─".repeat(10) +
      "┤",
  )

  // Sort by duration
  const sorted = [...results].sort((a, b) => a.duration - b.duration)

  for (const r of sorted) {
    const status = r.exitCode === 0 ? style.green("✓") : style.red("✗")
    const name = r.name.slice(0, 26).padEnd(26)
    const duration = formatDuration(r.duration).padEnd(8)
    const avgCpu = r.stats.avgTotal.toFixed(1).padStart(8) + "%"
    const maxCpu = r.stats.maxTotal.toFixed(1).padStart(8) + "%"
    const avgLoad = r.stats.avgLoad.toFixed(1).padStart(8)

    console.log(`│ ${status} ${name} │ ${duration} │ ${avgCpu}   │ ${maxCpu}   │ ${avgLoad} │`)
  }

  console.log(
    "└" +
      "─".repeat(30) +
      "┴" +
      "─".repeat(10) +
      "┴" +
      "─".repeat(12) +
      "┴" +
      "─".repeat(12) +
      "┴" +
      "─".repeat(10) +
      "┘",
  )

  // Find fastest
  const fastest = sorted[0]
  console.log(`\n${style.green("Fastest:")} ${fastest.name} at ${formatDuration(fastest.duration)}`)

  // Calculate efficiency (duration * avg CPU)
  const withEfficiency = sorted.map(r => ({
    ...r,
    efficiency: r.duration * r.stats.avgTotal,
  }))
  withEfficiency.sort((a, b) => a.efficiency - b.efficiency)
  const mostEfficient = withEfficiency[0]
  console.log(
    `${style.cyan("Most efficient:")} ${mostEfficient.name} (lowest duration × CPU product)`,
  )
}

/**
 * Save results to JSON file.
 */
function saveResults(results, options) {
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `benchmark-${options.config}-${options.suite}-${timestamp}.json`
  const filepath = path.join(resultsDir, filename)

  const data = {
    timestamp: new Date().toISOString(),
    options,
    results: results.map(r => ({
      name: r.name,
      cmd: r.cmd,
      exitCode: r.exitCode,
      duration: r.duration,
      stats: r.stats,
    })),
  }

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  console.log(`\nResults saved to: ${style.dim(filepath)}`)
}

/**
 * Main entry point.
 */
async function main() {
  const options = parseArgs()
  const configs = getBenchmarkConfigs(options.config, options.suite)

  console.log(style.bold("\nTest Runner CPU Benchmark\n"))
  console.log(`Config type: ${style.cyan(options.config)}`)
  console.log(`Suite: ${style.cyan(options.suite)}`)
  console.log(`Sample interval: ${style.cyan(options.sampleInterval + "ms")}`)
  console.log(`Configurations to test: ${style.cyan(configs.length)}\n`)

  if (options.dryRun) {
    console.log(style.yellow("Dry run - would execute:"))
    for (const config of configs) {
      console.log(`  ${style.dim(config.name)}: ${config.cmd.join(" ")}`)
    }
    return
  }

  if (configs.length === 0) {
    console.log(style.red("No configurations match the specified options."))
    process.exit(1)
  }

  const results = []

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]
    console.log(
      `[${i + 1}/${configs.length}] Running ${style.bold(config.name)}...`,
    )

    const result = await runBenchmark(
      config.name,
      config.cmd,
      config.cwd,
      options.sampleInterval,
    )
    results.push(result)

    const status = result.exitCode === 0 ? style.green("✓") : style.red("✗")
    console.log(
      `  ${status} Completed in ${formatDuration(result.duration)} ` +
        `(avg CPU: ${result.stats.avgTotal.toFixed(1)}%, load: ${result.stats.avgLoad.toFixed(1)})\n`,
    )

    // Show output on failure
    if (result.exitCode !== 0) {
      console.log(style.red("  Output:"))
      console.log(result.stderr || result.stdout)
    }
  }

  printComparison(results)
  saveResults(results, options)
}

main().catch(err => {
  console.error("Error:", err.message)
  process.exit(1)
})
