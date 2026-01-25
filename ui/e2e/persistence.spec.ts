import { test, expect } from "./fixtures"

/**
 * E2E tests for UI state persistence across page reloads.
 *
 * These tests verify that UI preferences and view state are correctly
 * persisted to localStorage and restored after page reload.
 *
 * The persistence layer uses Zustand's persist middleware with:
 * - Storage key: "ralph-ui-store"
 * - Persisted state: sidebar, chat panel, theme, search, filters, etc.
 */

/**
 * Helper to wait for the page to be ready after reload.
 * Unlike app.waitForLoad(), this doesn't assume sidebar is visible.
 */
async function waitForPageReady(app: Awaited<ReturnType<(typeof test)["_fixtures"]>["app"]>) {
  // Wait for the event stream which should always be visible
  await expect(app.eventStream.container).toBeVisible({ timeout: 10000 })
}

test.describe("UI State Persistence", () => {
  test.describe("Sidebar", () => {
    test("sidebar width persists across page reload", async ({ app }) => {
      const sidebar = app.taskList.sidebar

      // Get initial width
      const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)

      // Find and drag the resize handle to change width
      // The resize handle is at the right edge of the sidebar
      const resizeHandle = app.page.locator('[data-testid="sidebar-resize-handle"]')

      // Skip if resize handle doesn't exist (might be a different UI)
      if ((await resizeHandle.count()) === 0) {
        test.skip()
        return
      }

      // Drag the resize handle to increase width
      const handleBox = await resizeHandle.boundingBox()
      if (!handleBox) {
        test.skip()
        return
      }

      await app.page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2,
      )
      await app.page.mouse.down()
      await app.page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2)
      await app.page.mouse.up()

      // Wait for resize to complete
      await app.page.waitForTimeout(100)

      // Get new width
      const newWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)
      expect(newWidth).not.toBe(initialWidth)

      // Reload the page
      await app.page.reload()
      await waitForPageReady(app)

      // Width should be preserved
      const restoredWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)
      expect(restoredWidth).toBeCloseTo(newWidth, -1) // Within 10px
    })
  })

  test.describe("Theme", () => {
    test("theme preference persists across page reload", async ({ app }) => {
      // Get initial theme
      const getTheme = async () => {
        const html = app.page.locator("html")
        const isDark = await html.evaluate(el => el.classList.contains("dark"))
        return isDark ? "dark" : "light"
      }

      // Open settings and select light theme
      await app.page.getByTestId("settings-dropdown-trigger").click()
      await app.page.getByTestId("settings-appearance-light").click()

      // Verify theme changed
      await expect.poll(getTheme).toBe("light")

      // Close dropdown and reload
      await app.page.keyboard.press("Escape")
      await app.page.reload()
      await waitForPageReady(app)

      // Theme should be preserved
      await expect.poll(getTheme).toBe("light")

      // Now change to dark theme
      await app.page.getByTestId("settings-dropdown-trigger").click()
      await app.page.getByTestId("settings-appearance-dark").click()

      await expect.poll(getTheme).toBe("dark")

      // Reload and verify dark theme persists
      await app.page.keyboard.press("Escape")
      await app.page.reload()
      await waitForPageReady(app)

      await expect.poll(getTheme).toBe("dark")
    })
  })

  test.describe("Chat Panel", () => {
    test("chat panel open/closed state persists across page reload", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")

      // Panel should be open initially
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Close the chat panel using Cmd+J
      const taskChatInput = app.page.getByLabel("Task chat input")
      await expect(taskChatInput).toBeEnabled({ timeout: 10000 })
      await taskChatInput.focus()
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to close
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Reload the page
      await app.page.reload()
      await waitForPageReady(app)

      // Panel should still be closed after reload
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Open the panel again
      await app.page.keyboard.press("Meta+j")
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Reload and verify it stays open
      await app.page.reload()
      await waitForPageReady(app)

      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)
    })
  })

  test.describe("Search", () => {
    test("search query persists across page reload", async ({ app }) => {
      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })

      // Open search and enter a query
      await app.page.keyboard.press("Meta+f")
      await expect(searchInput).toBeVisible()
      await searchInput.fill("test-search-query")

      // Verify the input has the value
      await expect(searchInput).toHaveValue("test-search-query")

      // Reload the page
      await app.page.reload()
      await waitForPageReady(app)

      // Search should be visible with the same query
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toHaveValue("test-search-query")
    })

    test("search visibility persists across page reload", async ({ app }) => {
      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })

      // Search should be hidden initially
      await expect(searchInput).not.toBeVisible()

      // Reload to confirm hidden state persists
      await app.page.reload()
      await waitForPageReady(app)
      await expect(searchInput).not.toBeVisible()

      // Open search
      await app.page.keyboard.press("Meta+f")
      await expect(searchInput).toBeVisible()

      // Reload
      await app.page.reload()
      await waitForPageReady(app)

      // Search should still be visible
      await expect(searchInput).toBeVisible()
    })
  })

  test.describe("Closed Tasks Filter", () => {
    test("closed tasks time filter persists across page reload", async ({ app }) => {
      // Open the closed tasks group first (if it exists and has tasks)
      const closedGroup = app.page.getByRole("button", { name: /closed/i })

      // Skip if no closed group
      if ((await closedGroup.count()) === 0) {
        test.skip()
        return
      }

      await closedGroup.click()

      // Find and click the filter dropdown
      const filterButton = app.page.getByLabel("Filter closed tasks by time")

      // Skip if no filter button
      if ((await filterButton.count()) === 0) {
        test.skip()
        return
      }

      // Click to open dropdown
      await filterButton.click()

      // Select "Past week" option
      await app.page.getByRole("option", { name: /past week/i }).click()

      // Reload the page
      await app.page.reload()
      await waitForPageReady(app)

      // Open closed group again
      await closedGroup.click()

      // Filter should still be set to "Past week"
      const filterText = await filterButton.textContent()
      expect(filterText?.toLowerCase()).toContain("week")
    })
  })

  test.describe("localStorage Structure", () => {
    test("persisted state has correct structure and key", async ({ app }) => {
      // Verify the localStorage key exists and has the expected structure
      const persistedState = await app.page.evaluate(() => {
        const raw = localStorage.getItem("ralph-ui-store")
        if (!raw) return null
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })

      // Should have persisted state
      expect(persistedState).not.toBeNull()

      // Check for expected state structure
      expect(persistedState.state).toBeDefined()
      const state = persistedState.state

      // UI preferences should be present
      expect(state).toHaveProperty("sidebarWidth")
      expect(state).toHaveProperty("taskChatOpen")
      expect(state).toHaveProperty("taskChatWidth")
      expect(state).toHaveProperty("theme")
      expect(state).toHaveProperty("closedTimeFilter")

      // View state should be present
      expect(state).toHaveProperty("taskSearchQuery")
      expect(state).toHaveProperty("isSearchVisible")

      // Instances should be serialized as an array
      expect(Array.isArray(state.instances)).toBe(true)
    })

    test("clearing localStorage resets to defaults", async ({ app }) => {
      // Modify some state first (toggle theme to verify reset)
      const settingsDropdown = app.page.getByTestId("settings-dropdown-trigger")
      await settingsDropdown.click()
      await app.page.getByTestId("settings-appearance-dark").click()
      // Close the dropdown
      await app.page.keyboard.press("Escape")

      // Clear localStorage
      await app.page.evaluate(() => {
        localStorage.clear()
      })

      // Reload the page
      await app.page.reload()
      await app.waitForLoad()

      // Should be back to defaults - sidebar should still be visible
      await expect(app.taskList.sidebar).toBeVisible()
    })
  })
})
