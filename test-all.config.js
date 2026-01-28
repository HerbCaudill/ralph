/** Test runner configuration for ralph. */
export default {
  suites: [
    { name: "typecheck", command: "pnpm -r --parallel typecheck" },
    { name: "shared", command: "pnpm vitest run --reporter=json", type: "vitest", dir: "shared" },
    { name: "cli", command: "pnpm vitest run --reporter=json", type: "vitest", dir: "cli" },
    { name: "ui-vitest", command: "pnpm vitest run --reporter=json", type: "vitest", dir: "ui" },
    { name: "ui-playwright", command: "node scripts/playwright.js", type: "playwright" },
  ],
}
