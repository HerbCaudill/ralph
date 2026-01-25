import { test, expect } from "./fixtures"

/**
 * E2E tests for keyboard navigation and hotkeys.
 *
 * Note: Component-level hotkey tests have been migrated to Storybook:
 * - HotkeysDialog.stories.tsx
 * - CommandPalette.stories.tsx
 *
 * These E2E tests focus on global hotkeys that require the full app context.
 */
test.describe("Navigation", () => {
  test("Cmd+K focuses quick task input", async ({ app }) => {
    await app.page.locator("body").focus()
    await app.page.keyboard.press("Meta+k")
    await expect(app.taskList.quickTaskInput).toBeFocused()
  })

  test("Cmd+F shows search, accepts input, and Escape closes it", async ({ app }) => {
    const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })

    // Search input should be hidden initially
    await expect(searchInput).not.toBeVisible()

    // Cmd+F activates search
    await app.page.keyboard.press("Meta+f")
    await expect(searchInput).toBeVisible()

    // Fill and verify
    await expect
      .poll(async () => {
        await searchInput.fill("test")
        return searchInput.inputValue()
      })
      .toBe("test")

    // Escape closes search
    await app.page.keyboard.press("Escape")
    await expect(searchInput).not.toBeVisible()
  })

  test("Cmd+J focuses chat input, toggles panel, and re-focuses on open", async ({ app }) => {
    const leftPanel = app.page.getByTestId("left-panel")
    const taskChatInput = app.page.getByLabel("Task chat input")

    // Wait for chat input to be enabled
    await expect(taskChatInput).toBeEnabled({ timeout: 10000 })

    // Panel should be open initially
    await expect
      .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
      .toBeGreaterThan(0)

    // Focus something else first
    await app.taskList.quickTaskInput.click()
    await expect(app.taskList.quickTaskInput).toBeFocused()

    // First press: Focus the chat input (not toggle off)
    await app.page.keyboard.press("Meta+j")
    await expect(taskChatInput).toBeFocused()

    // Second press: Toggle off (since input is focused)
    await app.page.keyboard.press("Meta+j")
    await expect
      .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
      .toBeLessThanOrEqual(1)

    // Third press: Open and focus the input
    await app.page.keyboard.press("Meta+j")
    await expect
      .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
      .toBeGreaterThan(0)
    await expect(taskChatInput).toBeVisible()
    await expect(taskChatInput).toBeFocused()
  })

  test("Cmd+/ opens hotkeys dialog", async ({ app }) => {
    await app.page.keyboard.press("Meta+/")
    const dialog = app.page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible()
  })

  test("Cmd+; opens command palette", async ({ app }) => {
    await app.page.keyboard.press("Meta+;")
    await expect(app.page.getByTestId("command-palette")).toBeVisible()
  })
})
