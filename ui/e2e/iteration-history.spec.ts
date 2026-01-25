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
  test("opens and closes via button, close button, and Escape", async ({ app }) => {
    // History button should be visible
    await expect(app.iterationHistory.triggerButton).toBeVisible()

    // Click to open
    await app.iterationHistory.open()
    await expect(app.iterationHistory.sheet).toBeVisible()
    await expect(
      app.iterationHistory.sheet.locator("span", { hasText: "Iteration History" }),
    ).toBeVisible()

    // Close with X button
    await app.iterationHistory.sheet.getByRole("button", { name: "Close" }).click()
    await expect(app.iterationHistory.sheet).not.toBeVisible()

    // Reopen and close with Escape
    await app.iterationHistory.open()
    await expect(app.iterationHistory.sheet).toBeVisible()
    await app.iterationHistory.close()
    await expect(app.iterationHistory.sheet).not.toBeVisible()
  })
})
