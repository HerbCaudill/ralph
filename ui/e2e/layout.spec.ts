import { test, expect } from "./fixtures"

/**
 * E2E tests for layout behavior that requires full app context.
 *
 * Note: Simple visibility/presence tests have been migrated to Storybook:
 * - Header.stories.tsx (logo, workspace picker, settings dropdown)
 * - TaskSidebar.stories.tsx (sidebar, quick task input)
 * - MainLayout.stories.tsx (event stream, chat input, control bar, panels)
 *
 * These E2E tests focus on:
 * - Hotkey interactions (Cmd+B, Cmd+J)
 * - Theme control interactions
 * - Responsive layout behavior
 */
test.describe("Layout", () => {
  test.describe("header interactions", () => {
    test("can access and use theme controls via settings dropdown", async ({ app }) => {
      const settingsDropdown = app.page.getByTestId("settings-dropdown-trigger")

      // Open settings dropdown
      await settingsDropdown.click()

      // Appearance mode buttons should be visible
      await expect(app.page.getByTestId("settings-appearance-system")).toBeVisible()
      await expect(app.page.getByTestId("settings-appearance-light")).toBeVisible()
      await expect(app.page.getByTestId("settings-appearance-dark")).toBeVisible()

      // Can change theme by clicking an appearance mode button
      await app.page.getByTestId("settings-appearance-light").click()

      // Dropdown should remain open and light button should be highlighted
      await expect(app.page.getByTestId("settings-dropdown")).toBeVisible()
    })
  })

  test.describe("sidebar", () => {
    test("can toggle sidebar with Cmd+B", async ({ app }) => {
      // Sidebar should be visible initially
      await expect(app.taskList.sidebar).toBeVisible()

      // Toggle sidebar off
      await app.toggleSidebar()
      await expect(app.taskList.sidebar).not.toBeVisible()

      // Toggle sidebar back on
      await app.toggleSidebar()
      await expect(app.taskList.sidebar).toBeVisible()
    })
  })

  test.describe("panels", () => {
    test("can toggle left panel with Cmd+J", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const taskChatInput = app.page.getByLabel("Task chat input")

      // Wait for the chat input to be enabled (connection established)
      await expect(taskChatInput).toBeEnabled({ timeout: 10000 })

      // Panel should be open initially - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // First focus the chat input, then press Cmd+J to close
      // (new behavior: if not focused, first press focuses; second press toggles)
      await taskChatInput.click()
      await expect(taskChatInput).toBeFocused()
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to close (CSS transition) - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)
    })
  })

  test.describe("responsive layout", () => {
    test("layout fills viewport", async ({ app }) => {
      const viewportHeight = await app.page.evaluate(() => window.innerHeight)
      const viewportWidth = await app.page.evaluate(() => window.innerWidth)

      const { width: layoutWidth, height: layoutHeight } = await app.page.evaluate(() => {
        const layout = document.querySelector(".h-screen")
        const rect = layout?.getBoundingClientRect()
        return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
      })

      expect(layoutHeight).toBe(viewportHeight)
      expect(layoutWidth).toBe(viewportWidth)
    })
  })
})
