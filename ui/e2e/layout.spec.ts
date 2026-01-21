import { test, expect } from "./fixtures"

test.describe("Layout", () => {
  test.describe("header", () => {
    test("displays header with logo", async ({ app }) => {
      const header = app.page.getByTestId("header")
      await expect(header).toBeVisible()

      // Logo should be visible with "Ralph" text
      await expect(header.getByText("Ralph")).toBeVisible()
    })

    test("displays workspace picker in header", async ({ app }) => {
      const header = app.page.getByTestId("header")

      // Workspace picker is a button with aria-haspopup (dropdown trigger)
      const workspacePicker = header.getByRole("button", { name: /test-workspace|No workspace/i })
      await expect(workspacePicker).toBeVisible()
    })

    test("displays theme toggle in header", async ({ app }) => {
      const themeToggle = app.page.getByTestId("theme-toggle")
      await expect(themeToggle).toBeVisible()
    })

    test("can cycle theme via toggle", async ({ app }) => {
      const themeToggle = app.page.getByTestId("theme-toggle")

      // Get initial state
      const initialLabel = await themeToggle.getAttribute("aria-label")

      // Click to cycle theme
      await themeToggle.click()

      // Theme should have changed (aria-label should be different)
      await expect(themeToggle).not.toHaveAttribute("aria-label", initialLabel!)
    })
  })

  test.describe("sidebar", () => {
    test("displays sidebar with task list", async ({ app }) => {
      await expect(app.taskList.sidebar).toBeVisible()
    })

    test("displays quick task input in sidebar", async ({ app }) => {
      await expect(app.taskList.quickTaskInput).toBeVisible()
    })

    test("shows search input when activated via hotkey", async ({ app }) => {
      // Search input is hidden by default
      const searchInput = app.page.getByRole("textbox", { name: "Search tasks" })
      await expect(searchInput).not.toBeVisible()

      // Activate search with Cmd+F hotkey
      await app.page.keyboard.press("Meta+f")

      // Search input should now be visible
      await expect(searchInput).toBeVisible()
    })

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

  test.describe("main content area", () => {
    test("displays event stream", async ({ app }) => {
      await expect(app.eventStream.container).toBeVisible()
    })

    test("displays chat input", async ({ app }) => {
      await expect(app.chat.messageInput).toBeVisible()
    })

    test("displays control bar with start button", async ({ app }) => {
      await expect(app.page.getByRole("button", { name: "Start" })).toBeVisible()
    })
  })

  test.describe("panels", () => {
    test("left panel (task chat) is open by default", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      // Left panel (task chat) is open by default with non-zero width
      const width = await leftPanel.evaluate(el => el.getBoundingClientRect().width)
      expect(width).toBeGreaterThan(0)
    })

    test("can toggle left panel with hotkey", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const taskChatInput = app.page.getByLabel("Task chat input")

      // Wait for the chat input to be enabled (connection established)
      await expect(taskChatInput).toBeEnabled({ timeout: 5000 })

      // Panel should be open initially
      const initialWidth = await leftPanel.evaluate(el => el.getBoundingClientRect().width)
      expect(initialWidth).toBeGreaterThan(0)

      // First focus the chat input, then press Cmd+J to close
      // (new behavior: if not focused, first press focuses; second press toggles)
      await taskChatInput.click()
      await expect(taskChatInput).toBeFocused()
      await app.page.keyboard.press("Meta+j")

      // Wait for CSS transition to complete (200ms duration + buffer)
      await app.page.waitForTimeout(300)

      // Panel should be closed now (width is 0, but border may add 1px)
      const closedWidth = await leftPanel.evaluate(el => el.getBoundingClientRect().width)
      expect(closedWidth).toBeLessThanOrEqual(1)
    })

    test("right panel is hidden by default", async ({ app }) => {
      const rightPanel = app.page.getByTestId("right-panel")
      // Right panel (event log viewer) is hidden by default (width is 0, but border may add 1px)
      const width = await rightPanel.evaluate(el => el.getBoundingClientRect().width)
      expect(width).toBeLessThanOrEqual(1)
    })
  })

  test.describe("responsive layout", () => {
    test("layout fills viewport height", async ({ app }) => {
      const viewportHeight = await app.page.evaluate(() => window.innerHeight)
      const layoutHeight = await app.page.evaluate(() => {
        const layout = document.querySelector(".h-screen")
        return layout?.getBoundingClientRect().height ?? 0
      })

      expect(layoutHeight).toBe(viewportHeight)
    })

    test("layout fills viewport width", async ({ app }) => {
      const viewportWidth = await app.page.evaluate(() => window.innerWidth)
      const layoutWidth = await app.page.evaluate(() => {
        const layout = document.querySelector(".h-screen")
        return layout?.getBoundingClientRect().width ?? 0
      })

      expect(layoutWidth).toBe(viewportWidth)
    })
  })
})
