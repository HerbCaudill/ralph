#!/usr/bin/env node
/**
 * Runs all tests across packages and reports summary statistics.
 *
 * Usage:
 *   node scripts/test-all.js           # Run all tests
 *   node scripts/test-all.js --changed # Run only tests affected by uncommitted changes
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { testAll } from "./lib/testAll.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

const changedMode = process.argv.includes("--changed")
const vitestArgs = [
  "pnpm",
  "vitest",
  "run",
  "--reporter=json",
  ...(changedMode ? ["--changed"] : []),
]

await testAll(
  [
    { name: "typecheck", command: ["pnpm", "-r", "--parallel", "typecheck"], cwd: repoRoot },
    { name: "shared", command: vitestArgs, parser: "vitest", cwd: path.join(repoRoot, "shared") },
    { name: "cli", command: vitestArgs, parser: "vitest", cwd: path.join(repoRoot, "cli") },
    { name: "ui-vitest", command: vitestArgs, parser: "vitest", cwd: path.join(repoRoot, "ui") },
    {
      name: "ui-playwright",
      command: ["node", "scripts/playwright.js"],
      parser: "playwright",
      cwd: repoRoot,
    },
  ],
  {
    title: changedMode ? "Running all tests (vitest: --changed)" : "Running all tests",
  },
)
