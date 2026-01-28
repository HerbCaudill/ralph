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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const changedMode = process.argv.includes("--changed")
const vitestCmd = `pnpm vitest run --reporter=json${changedMode ? " --changed" : ""}`

await testAll(
  [
    { name: "typecheck", command: "pnpm -r --parallel typecheck" },
    { name: "shared", command: vitestCmd, type: "vitest", dir: "shared" },
    { name: "cli", command: vitestCmd, type: "vitest", dir: "cli" },
    { name: "ui-vitest", command: vitestCmd, type: "vitest", dir: "ui" },
    { name: "ui-playwright", command: "node scripts/playwright.js", type: "playwright" },
  ],
  {
    cwd: repoRoot,
    title: changedMode ? "Running all tests (vitest: --changed)" : "Running all tests",
  },
)
