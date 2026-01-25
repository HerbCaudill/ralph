import { test, expect } from "./fixtures"

/**
 * E2E tests for the task chat panel.
 *
 * These tests cover chat functionality that requires the full app context,
 * including interaction with tasks and server state.
 *
 * Note: Chat panel toggle (Cmd+J) is tested in navigation.spec.ts
 * Note: Chat panel persistence is tested in persistence.spec.ts
 */
test.describe("Task Chat", () => {
  test.describe("visibility", () => {
    test("chat panel is visible on page load", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      await expect(leftPanel).toBeVisible()

      // Panel should have non-zero width
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)
    })

    test("chat panel has correct heading", async ({ app }) => {
      await expect(app.page.getByText("Task Chat")).toBeVisible()
    })
  })

  test.describe("input", () => {
    test("chat input is visible and can receive focus", async ({ app }) => {
      const chatInput = app.page.getByLabel("Task chat input")
      await expect(chatInput).toBeVisible()
      await expect(chatInput).toBeEnabled()

      // Click to focus
      await chatInput.click()
      await expect(chatInput).toBeFocused()
    })

    test("chat input accepts text", async ({ app }) => {
      const chatInput = app.page.getByLabel("Task chat input")
      await expect(chatInput).toBeEnabled()

      await chatInput.fill("Test message")
      await expect(chatInput).toHaveValue("Test message")
    })

    test("Cmd+J focuses chat input when panel is open", async ({ app }) => {
      const chatInput = app.page.getByLabel("Task chat input")

      // Wait for chat input to be enabled (connected)
      await expect(chatInput).toBeEnabled({ timeout: 10000 })

      // First focus something else
      await app.taskList.quickTaskInput.click()
      await expect(app.taskList.quickTaskInput).toBeFocused()

      // Use Cmd+J to focus chat
      await app.page.keyboard.press("Meta+j")

      await expect(chatInput).toBeFocused()
    })

    test("chat input shows placeholder text", async ({ app }) => {
      const chatInput = app.page.getByLabel("Task chat input")
      await expect(chatInput).toBeVisible()

      // Check placeholder - could be "How can I help?" or similar
      const placeholder = await chatInput.getAttribute("placeholder")
      expect(placeholder).toBeTruthy()
    })
  })

  test.describe("controls", () => {
    test("close button is visible and closes the panel", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")
      const closeButton = app.page.getByLabel("Close task chat")

      // Panel should be open
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Close button should be visible
      await expect(closeButton).toBeVisible()

      // Click close button
      await closeButton.click()

      // Panel should be closed
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)
    })

    test("clear chat history button is visible", async ({ app }) => {
      const clearButton = app.page.getByLabel("Clear chat history")
      await expect(clearButton).toBeVisible()
    })

    test("chat history dropdown is visible", async ({ app }) => {
      // The history dropdown should be present in the header
      const historyDropdown = app.page.getByLabel("View chat history")
      await expect(historyDropdown).toBeVisible()
    })
  })

  test.describe("empty state", () => {
    test("shows empty state when no messages", async ({ app }) => {
      // The chat should show an empty state on fresh load
      const emptyStateText = app.page.getByText("Manage your tasks")
      await expect(emptyStateText).toBeVisible()
    })

    test("shows help text in empty state", async ({ app }) => {
      const helpText = app.page.getByText(
        "Get help researching issues and creating and working with tasks",
      )
      await expect(helpText).toBeVisible()
    })
  })

  test.describe("resize", () => {
    test("chat panel can be resized", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")

      // Get initial width
      const initialWidth = await leftPanel.evaluate(el => el.getBoundingClientRect().width)

      // Find the resize handle (right edge of left panel)
      const resizeHandle = app.page.getByTestId("left-panel-resize-handle")

      // Skip if no resize handle
      if ((await resizeHandle.count()) === 0) {
        test.skip()
        return
      }

      const handleBox = await resizeHandle.boundingBox()
      if (!handleBox) {
        test.skip()
        return
      }

      // Drag to resize
      await app.page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2,
      )
      await app.page.mouse.down()
      await app.page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2)
      await app.page.mouse.up()

      // Wait for resize to complete
      await app.page.waitForTimeout(100)

      // Width should have changed
      const newWidth = await leftPanel.evaluate(el => el.getBoundingClientRect().width)
      expect(newWidth).not.toBe(initialWidth)
    })
  })

  test.describe("interaction with tasks", () => {
    test("creating a task does not affect chat panel visibility", async ({ app }) => {
      const leftPanel = app.page.getByTestId("left-panel")

      // Panel should be open initially
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Create a task
      await app.taskList.createTask("Test task for chat E2E")

      // Panel should still be open
      await expect
        .poll(() => leftPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeGreaterThan(0)

      // Chat input should still be accessible
      const chatInput = app.page.getByLabel("Task chat input")
      await expect(chatInput).toBeVisible()
    })
  })
})
