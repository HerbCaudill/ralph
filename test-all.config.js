/** Test runner configuration for ralph. */
export default {
  suites: [
    { name: "typecheck", command: "pnpm -r --parallel typecheck" },
    { name: "shared", command: "pnpm --filter @herbcaudill/ralph-shared test", type: "vitest" },
    { name: "cli", command: "pnpm --filter @herbcaudill/ralph test", type: "vitest" },
    { name: "ui-vitest", command: "pnpm --filter @herbcaudill/ralph-ui test", type: "vitest" },
    {
      name: "ui-playwright",
      command: "pnpm --filter @herbcaudill/ralph-ui test:pw",
      type: "playwright",
    },
  ],
}
