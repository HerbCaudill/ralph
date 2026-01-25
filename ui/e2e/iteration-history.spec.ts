import { test, expect } from "./fixtures"

/**
 * E2E tests for iteration history sheet integration.
 *
 * Note: UI behavior tests (empty state, search input, date groups, accessibility, etc.)
 * have been migrated to Storybook: IterationHistoryPanel.stories.tsx
 *
 * These E2E tests focus on integration behavior that requires the full app context.
 */
test.describe("Iteration History Sheet", () => {
  test.describe("opening and closing", () => {
    test("History button is visible in sidebar", async ({ app }) => {
      await expect(app.iterationHistory.triggerButton).toBeVisible()
    })

    test("clicking History button opens the sheet", async ({ app }) => {
      await app.iterationHistory.open()

      // Sheet should be visible with the header
      await expect(app.iterationHistory.sheet).toBeVisible()
      await expect(
        app.iterationHistory.sheet.locator("span", { hasText: "Iteration History" }),
      ).toBeVisible()
    })

    test("Escape closes the sheet", async ({ app }) => {
      await app.iterationHistory.open()
      await expect(app.iterationHistory.sheet).toBeVisible()

      await app.iterationHistory.close()
      await expect(app.iterationHistory.sheet).not.toBeVisible()
    })

    test("close button closes the sheet", async ({ app }) => {
      await app.iterationHistory.open()
      await expect(app.iterationHistory.sheet).toBeVisible()

      // Click the X button to close the sheet
      await app.iterationHistory.sheet.getByRole("button", { name: "Close" }).click()
      await expect(app.iterationHistory.sheet).not.toBeVisible()
    })
  })

  test.describe("accessibility", () => {
    test("sheet has accessible title", async ({ app }) => {
      await app.iterationHistory.open()

      // The sheet should have Iteration History as a title (screen reader accessible)
      await expect(app.page.getByRole("heading", { name: "Iteration History" })).toBeAttached()
    })
  })
})
