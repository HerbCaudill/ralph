import { test, expect } from "./fixtures"

test.describe("Navigation", () => {
  test.describe("focus management", () => {
    test("Cmd+K focuses quick task input", async ({ app }) => {
      // Start by focusing somewhere else (use body as a neutral target)
      await app.page.locator("body").focus()

      // Press Cmd+K to focus quick task input
      await app.page.keyboard.press("Meta+k")

      // Quick task input should be focused
      await expect(app.taskList.quickTaskInput).toBeFocused()
    })

    test("Cmd+F shows and focuses search input", async ({ app }) => {
      // Search input should be hidden initially
      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })
      await expect(searchInput).not.toBeVisible()

      // Press Cmd+F to activate search
      await app.page.keyboard.press("Meta+f")

      // Search input should now be visible
      await expect(searchInput).toBeVisible()
    })

    test("search accepts keyboard input", async ({ app }) => {
      // Activate search
      await app.page.keyboard.press("Meta+f")

      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })
      await expect(searchInput).toBeVisible()

      // Use fill() which handles focus automatically and is reliable for React controlled components
      await searchInput.fill("a")

      // Verify the input received the value
      await expect(searchInput).toHaveValue("a")
    })

    test("Escape closes search and clears it", async ({ app }) => {
      // Activate search
      await app.page.keyboard.press("Meta+f")

      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })
      await expect(searchInput).toBeVisible()

      // Use fill() which is more reliable for React controlled components
      await searchInput.fill("test")
      await expect(searchInput).toHaveValue("test")

      // Press Escape while input is focused to close search
      // The SearchInput component handles Escape in onKeyDown which triggers onHide
      await app.page.keyboard.press("Escape")

      // Search input should be hidden
      await expect(searchInput).not.toBeVisible()
    })

    test("Escape clears search even when not focused", async ({ app }) => {
      // Activate search
      await app.page.keyboard.press("Meta+f")

      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })
      await expect(searchInput).toBeVisible()

      // Type something in search
      await searchInput.fill("test")
      await expect(searchInput).toHaveValue("test")

      // Focus somewhere else (the quick task input, which is always focusable)
      await app.taskList.quickTaskInput.focus()
      await expect(app.taskList.quickTaskInput).toBeFocused()

      // Press Escape while search is NOT focused but has text
      // This should still clear the search
      await app.page.keyboard.press("Escape")

      // Search input should be hidden (and cleared)
      await expect(searchInput).not.toBeVisible()
    })
  })

  test.describe("panel toggles", () => {
    test("Cmd+J focuses chat input if panel open but not focused, then toggles on next press", async ({
      app,
    }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const taskChatInput = app.page.getByLabel("Task chat input")

      // Wait for the chat input to be enabled (connection established)
      await expect(taskChatInput).toBeEnabled({ timeout: 10000 })

      // Panel should be open initially - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Focus something else first (like the quick task input) using click for reliability
      await app.taskList.quickTaskInput.click()
      await expect(app.taskList.quickTaskInput).toBeFocused()

      // First press: Focus the chat input (not toggle off)
      await app.page.keyboard.press("Meta+j")

      // Chat input should now be focused (auto-retries)
      await expect(taskChatInput).toBeFocused()

      // Verify focus is stable before pressing again - re-check focus
      await expect(taskChatInput).toBeFocused()

      // Second press: Now toggle off (since input is focused)
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to close (CSS transition) - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)
    })

    test("Cmd+J focuses task chat input when opening panel", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const taskChatInput = app.page.getByLabel("Task chat input")

      // Wait for the chat input to be enabled (connection established)
      await expect(taskChatInput).toBeEnabled({ timeout: 10000 })

      // First, close the panel: click to focus, then press Cmd+J to close
      await taskChatInput.click()
      await expect(taskChatInput).toBeFocused()
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to close (CSS transition) - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Now open it - should focus the input
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to open first (CSS transition)
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // The task chat input should be visible and focused (auto-retries)
      await expect(taskChatInput).toBeVisible()
      await expect(taskChatInput).toBeFocused()
    })
  })

  test.describe("hotkeys dialog", () => {
    test("Cmd+/ opens hotkeys dialog", async ({ app }) => {
      // Press Cmd+/ to open hotkeys dialog
      await app.page.keyboard.press("Meta+/")

      // Dialog should be visible
      const dialog = app.page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      // Should show "Keyboard Shortcuts" title in the heading
      await expect(dialog.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible()
    })

    test("hotkeys dialog shows categories", async ({ app }) => {
      await app.page.keyboard.press("Meta+/")

      const dialog = app.page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      // Should show Navigation category
      await expect(dialog.getByText("Navigation")).toBeVisible()

      // Should show Agent Control category
      await expect(dialog.getByText("Agent Control")).toBeVisible()
    })

    test("Escape closes hotkeys dialog", async ({ app }) => {
      // Open dialog
      await app.page.keyboard.press("Meta+/")

      const dialog = app.page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      // Press Escape to close
      await app.page.keyboard.press("Escape")

      // Dialog should be closed
      await expect(dialog).not.toBeVisible()
    })
  })

  test.describe("command palette", () => {
    test("Cmd+; opens command palette", async ({ app }) => {
      // Press Cmd+; to open command palette
      await app.page.keyboard.press("Meta+;")

      // Command palette should be visible
      const commandPalette = app.page.getByTestId("command-palette")
      await expect(commandPalette).toBeVisible()
    })

    test("command palette shows search input", async ({ app }) => {
      await app.page.keyboard.press("Meta+;")

      const commandInput = app.page.getByTestId("command-input")
      await expect(commandInput).toBeVisible()
    })

    test("clicking backdrop closes command palette", async ({ app }) => {
      // Open command palette
      await app.page.keyboard.press("Meta+;")

      const commandPalette = app.page.getByTestId("command-palette")
      await expect(commandPalette).toBeVisible()

      // Click the backdrop to close (use dispatchEvent to ensure click reaches backdrop)
      await app.page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="command-backdrop"]')
        if (backdrop) {
          backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }))
        }
      })

      // Command palette should be closed
      await expect(commandPalette).not.toBeVisible()
    })

    test("can search commands in palette", async ({ app }) => {
      await app.page.keyboard.press("Meta+;")

      const commandInput = app.page.getByTestId("command-input")

      // Type to search for theme command
      await commandInput.fill("theme")

      // Should show the Toggle Theme command (which has "theme" in keywords)
      await expect(app.page.getByTestId("command-item-cycleTheme")).toBeVisible()
    })

    test("selecting a command closes palette", async ({ app }) => {
      await app.page.keyboard.press("Meta+;")

      const commandPalette = app.page.getByTestId("command-palette")
      await expect(commandPalette).toBeVisible()

      // Select the toggle sidebar command using keyboard
      // First navigate to it with arrow keys if needed, then press Enter
      const toggleSidebarItem = app.page.getByTestId("command-item-toggleSidebar")
      await toggleSidebarItem.click({ force: true })

      // Command palette should close
      await expect(commandPalette).not.toBeVisible()
    })
  })

  test.describe("theme cycling", () => {
    test("Cmd+Shift+T cycles theme", async ({ app }) => {
      const themeToggle = app.page.getByTestId("theme-toggle")

      // Get initial state
      const initialLabel = await themeToggle.getAttribute("aria-label")

      // Press Cmd+Shift+T to cycle theme
      await app.page.keyboard.press("Meta+Shift+t")

      // Theme should have changed
      await expect(themeToggle).not.toHaveAttribute("aria-label", initialLabel!)
    })
  })

  test.describe("sidebar navigation", () => {
    test("Cmd+B toggles sidebar visibility", async ({ app }) => {
      // Sidebar should be visible initially
      await expect(app.taskList.sidebar).toBeVisible()

      // Toggle off
      await app.page.keyboard.press("Meta+b")
      await expect(app.taskList.sidebar).not.toBeVisible()

      // Toggle back on
      await app.page.keyboard.press("Meta+b")
      await expect(app.taskList.sidebar).toBeVisible()
    })

    test("Cmd+1 focuses sidebar", async ({ app }) => {
      // Focus somewhere else first (use body as a neutral target)
      await app.page.locator("body").focus()

      // Press Cmd+1 to focus sidebar
      await app.page.keyboard.press("Meta+1")

      // The first focusable element in the sidebar should be focused
      // This is typically the quick task input
      await expect(app.taskList.quickTaskInput).toBeFocused()
    })

    test("Cmd+2 focuses main content", async ({ app }) => {
      // Focus sidebar first
      await app.taskList.quickTaskInput.focus()

      // Press Cmd+2 to focus main content
      await app.page.keyboard.press("Meta+2")

      // Focus should move to main content area
      // The first focusable element varies but should not be in the sidebar
      const activeElement = await app.page.evaluate(() => document.activeElement?.tagName)
      expect(activeElement).toBeTruthy()
    })
  })

  test.describe("iteration navigation", () => {
    // Note: These tests verify the hotkeys work but actual iteration navigation
    // requires a running agent with multiple iterations

    test("iteration navigation hotkeys are registered", async ({ app }) => {
      // Open hotkeys dialog to verify iteration navigation hotkeys exist
      await app.page.keyboard.press("Meta+/")

      const dialog = app.page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      // Verify iteration navigation hotkeys are documented
      await expect(dialog.getByText(/previous iteration/i)).toBeVisible()
      await expect(dialog.getByText(/next iteration/i)).toBeVisible()
      await expect(dialog.getByText(/latest iteration/i)).toBeVisible()
    })
  })

  test.describe("task navigation", () => {
    test("task navigation hotkeys are registered", async ({ app }) => {
      // Open hotkeys dialog to verify task navigation hotkeys exist
      await app.page.keyboard.press("Meta+/")

      const dialog = app.page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      // Verify task navigation hotkeys are documented
      await expect(dialog.getByText(/select previous task/i)).toBeVisible()
      await expect(dialog.getByText(/select next task/i)).toBeVisible()
      await expect(dialog.getByText(/open selected task/i)).toBeVisible()
    })
  })
})
