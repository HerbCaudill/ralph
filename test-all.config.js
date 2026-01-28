/**
 * Test runner configuration for ralph.
 * Used by `node scripts/lib/testAll.js`.
 */
export default flags => {
  const changed = flags.includes("--changed")
  const vitestCmd = `pnpm vitest run --reporter=json${changed ? " --changed" : ""}`

  return {
    suites: [
      { name: "typecheck", command: "pnpm -r --parallel typecheck" },
      { name: "shared", command: vitestCmd, type: "vitest", dir: "shared" },
      { name: "cli", command: vitestCmd, type: "vitest", dir: "cli" },
      { name: "ui-vitest", command: vitestCmd, type: "vitest", dir: "ui" },
      { name: "ui-playwright", command: "node scripts/playwright.js", type: "playwright" },
    ],
    options: {
      title: changed ? "Running all tests (vitest: --changed)" : "Running all tests",
    },
  }
}
