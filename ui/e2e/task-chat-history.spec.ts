import { test, expect } from "./fixtures"

/**
 * E2E tests for task chat history dropdown integration.
 *
 * Note: UI behavior tests (trigger visibility, opening/closing, search, empty state,
 * session display, accessibility, etc.) have been migrated to Storybook:
 * TaskChatHistoryDropdown.stories.tsx
 *
 * These E2E tests focus on integration behavior that requires the full app context.
 */
test.describe("Task Chat History Dropdown", () => {
  test.describe("opening and closing", () => {
    test("clicking outside closes the dropdown", async ({ app }) => {
      await app.taskChatHistory.open()
      await expect(app.taskChatHistory.popover).toBeVisible()

      // Click outside the popover
      await app.page.locator("body").click({ position: { x: 10, y: 10 } })
      await expect(app.taskChatHistory.popover).not.toBeVisible()
    })
  })
})
