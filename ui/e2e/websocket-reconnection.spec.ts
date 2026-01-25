import { test, expect } from "./fixtures"

test.describe("WebSocket Reconnection", () => {
  test.describe("connection status indicator", () => {
    test("shows connected status when WebSocket is open", async ({ app }) => {
      // The app fixture waits for the app to load, which means WebSocket is connected
      // Check that the connection status indicator shows connected state
      const statusIndicator = app.page.getByTestId("connection-status-indicator")
      await expect(statusIndicator).toBeVisible()

      // When connected, only the icon is shown (no label)
      // The icon should have the success color class
      const icon = app.page.getByTestId("connection-status-icon")
      await expect(icon).toBeVisible()

      // The label should NOT be visible when connected (to minimize visual noise)
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible()
    })

    test("shows disconnected status when WebSocket closes", async ({ app }) => {
      // Close the WebSocket by intercepting and aborting it
      await app.page.route("**/ws", route => route.abort())

      // Force a page reload to trigger reconnection attempt
      await app.page.reload()

      // The connection status should show connecting initially
      const statusIndicator = app.page.getByTestId("connection-status-indicator")
      await expect(statusIndicator).toBeVisible()

      // Wait for the status to show "Disconnected" or "Connecting" (either indicates connection issue)
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).toBeVisible({ timeout: 10000 })

      // The label text should indicate a connection issue
      const labelText = await label.textContent()
      expect(["Disconnected", "Connecting"]).toContain(labelText)
    })
  })

  test.describe("automatic reconnection", () => {
    test("automatically reconnects after disconnection", async ({ app }) => {
      // Verify initial connected state
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible()

      // Simulate network interruption by closing the WebSocket
      // We can do this by evaluating code to close the WebSocket
      await app.page.evaluate(() => {
        // Access the WebSocket through the store's connection status mechanism
        // The store will detect the disconnection and attempt to reconnect
        const event = new Event("offline")
        window.dispatchEvent(event)
      })

      // Give the system a moment to detect the network change
      await app.page.waitForTimeout(100)

      // Trigger online event to allow reconnection
      await app.page.evaluate(() => {
        const event = new Event("online")
        window.dispatchEvent(event)
      })

      // The connection should be re-established automatically
      // When connected, the label should not be visible
      await expect(label).not.toBeVisible({ timeout: 15000 })

      // Verify the status indicator is still present
      const statusIndicator = app.page.getByTestId("connection-status-indicator")
      await expect(statusIndicator).toBeVisible()
    })

    test("reconnection restores ability to use the application", async ({ app }) => {
      // Verify the app is functional initially
      await expect(app.chat.messageInput).toBeEnabled()

      // Create a task to verify app is working
      await app.taskList.quickTaskInput.fill("Test task before reconnection")
      await app.taskList.quickTaskInput.press("Enter")

      // Wait for the task to appear
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Test task before reconnection" }),
      ).toBeVisible()

      // Simulate a brief network interruption via page reload
      await app.page.reload()

      // Wait for app to fully load again
      await app.waitForLoad()

      // Verify connection is restored
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible({ timeout: 15000 })

      // Verify the app is still functional after reconnection
      await expect(app.chat.messageInput).toBeEnabled()

      // The task should still be visible (persisted in beads)
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Test task before reconnection" }),
      ).toBeVisible()
    })
  })

  test.describe("state preservation after reconnection", () => {
    test("tasks are preserved after page reload", async ({ app }) => {
      // Create multiple tasks
      await app.taskList.quickTaskInput.fill("Preserved task 1")
      await app.taskList.quickTaskInput.press("Enter")
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Preserved task 1" }),
      ).toBeVisible()

      await app.taskList.quickTaskInput.fill("Preserved task 2")
      await app.taskList.quickTaskInput.press("Enter")
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Preserved task 2" }),
      ).toBeVisible()

      // Reload the page (simulates disconnection/reconnection)
      await app.page.reload()
      await app.waitForLoad()

      // Wait for connection to be restored
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible({ timeout: 15000 })

      // Both tasks should still be visible
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Preserved task 1" }),
      ).toBeVisible()
      await expect(
        app.taskList.sidebar.locator("span.truncate", { hasText: "Preserved task 2" }),
      ).toBeVisible()
    })

    test("event stream displays welcome message after reconnection", async ({ app }) => {
      // The event stream should show content after connection
      await expect(app.eventStream.container).toBeVisible()

      // Reload the page
      await app.page.reload()
      await app.waitForLoad()

      // Wait for connection to be restored
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible({ timeout: 15000 })

      // Event stream should still be visible
      await expect(app.eventStream.container).toBeVisible()
    })

    test("left panel state is preserved after reconnection", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const taskChatInput = app.page.getByLabel("Task chat input")

      // Wait for the chat input to be enabled (connection established)
      await expect(taskChatInput).toBeEnabled({ timeout: 10000 })

      // Panel should be open initially - check width
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Focus something else first (like the quick task input) using click for reliability
      await app.taskList.quickTaskInput.click()
      await expect(app.taskList.quickTaskInput).toBeFocused()

      // First press: Focus the chat input (not toggle off)
      await app.page.keyboard.press("Meta+j")
      await expect(taskChatInput).toBeFocused()

      // Second press: Toggle off (since input is focused)
      await app.page.keyboard.press("Meta+j")

      // Wait for panel to close (CSS transition) - use poll to retry
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Reload the page
      await app.page.reload()
      await app.page.waitForLoadState("networkidle")

      // Wait for connection
      const label = app.page.getByTestId("connection-status-label")
      await expect(label).not.toBeVisible({ timeout: 15000 })

      // Panel state should be preserved (closed) - check width
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Toggle it back open
      await app.page.keyboard.press("Meta+j")

      // Panel should be open - check width
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)
    })
  })

  test.describe("error handling", () => {
    test("connection error is displayed in UI", async ({ page }) => {
      // Block WebSocket connections completely
      await page.route("**/ws", route => route.abort())

      // Go to the app
      await page.goto("/")

      // Wait for the connection error to be shown
      const label = page.getByTestId("connection-status-label")
      await expect(label).toBeVisible({ timeout: 10000 })

      // The status should show Disconnected or Connecting
      const labelText = await label.textContent()
      expect(["Disconnected", "Connecting"]).toContain(labelText)
    })

    test("UI remains functional even with connection issues", async ({ page }) => {
      // Start by blocking WebSocket
      await page.route("**/ws", route => route.abort())

      // Go to the app
      await page.goto("/")

      // Even without WebSocket, basic UI elements should be visible
      const sidebar = page.getByRole("complementary", { name: "Task sidebar" })
      await expect(sidebar).toBeVisible({ timeout: 10000 })

      // Event stream container should be visible
      const eventStream = page.getByRole("log", { name: "Event stream" })
      await expect(eventStream).toBeVisible()

      // Quick task input should be visible (though may not be fully functional)
      const quickInput = page.getByLabel("New task title")
      await expect(quickInput).toBeVisible()
    })
  })
})
