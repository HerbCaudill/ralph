/** Test runner configuration for ralph. */
export default {
  suites: [
    { name: "typecheck", command: "pnpm -r --parallel typecheck" },
    { name: "shared", command: "pnpm --filter ralph-shared test" },
    { name: "cli", command: "pnpm --filter ralph test" },
    { name: "ui-vitest", command: "pnpm --filter ralph-ui test" },
    { name: "ui-playwright", command: "pnpm --filter ralph-ui test:pw" },
  ],
}
