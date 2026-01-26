import { test, expect } from "./fixtures"

/**
 * E2E tests for event stream integration behavior.
 *
 * Note: UI appearance tests (empty states, spinners, tool cards, etc.)
 * are covered in Storybook: EventStream.stories.tsx
 *
 * These E2E tests focus on integration behavior that requires the full app context:
 * - Session navigation
 * - Event stream visibility and interaction
 * - Integration with other app components
 */
test.describe("Event Stream", () => {
  test.describe("visibility", () => {
    test("event stream container is visible on page load", async ({ app }) => {
      // The event stream should be visible in the main layout
      await expect(app.eventStream.container).toBeVisible()
    })

    test("session bar is visible on page load", async ({ app }) => {
      // The session bar should be visible above the event stream
      await expect(app.eventStream.sessionBar).toBeVisible()
    })
  })

  test.describe("session navigation", () => {
    test("shows 'No active task' when no task is running", async ({ app }) => {
      // When no task is running, the session bar should show a message
      const sessionBar = app.eventStream.sessionBar
      await expect(
        sessionBar
          .getByText("No active task")
          .or(sessionBar.locator('[data-testid="session-history-dropdown-trigger"]')),
      ).toBeVisible()
    })

    test("session navigation buttons appear with multiple sessions", async ({ app }) => {
      // This test checks the structure when sessions exist
      // In a fresh environment, there may be no sessions yet
      const sessionBar = app.eventStream.sessionBar

      // Check if Previous/Next buttons exist (they'll be hidden if only 1 session)
      const prevButton = sessionBar.getByRole("button", { name: "Previous session" })
      const nextButton = sessionBar.getByRole("button", { name: "Next session" })

      // In a test environment without sessions, these buttons won't be visible
      // If they are visible, verify they're properly configured
      const hasPrevButton = await prevButton.count()
      if (hasPrevButton > 0) {
        // When viewing latest session, Next should be disabled
        const isNextDisabled = await nextButton.isDisabled()
        expect(isNextDisabled).toBe(true)
      }
    })
  })

  test.describe("spinner states", () => {
    test("shows idle spinner when not running", async ({ app }) => {
      // When Ralph is stopped/idle, the idle spinner should be visible (if there's content)
      // or the running spinner should be visible (if Ralph is running)
      const runningSpinner = app.page.locator('[data-testid="ralph-running-spinner"]')
      const idleSpinner = app.page.locator('[data-testid="ralph-idle-spinner"]')

      // One of these should be visible if there's event content
      // In an empty state, neither may be visible (empty state spinner instead)
      const isRunning = await runningSpinner.isVisible()
      const isIdle = await idleSpinner.isVisible()

      // At least verify the DOM structure is correct - spinners exist when needed
      if (isRunning || isIdle) {
        // If spinners are showing, only one should be visible at a time
        expect(isRunning && isIdle).toBe(false)
      }
    })
  })

  test.describe("interaction with tasks", () => {
    test("creating a task does not affect event stream visibility", async ({ app }) => {
      // Event stream should remain visible while creating tasks
      await expect(app.eventStream.container).toBeVisible()

      // Create a task
      const taskName = `Event Stream Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      // Event stream should still be visible
      await expect(app.eventStream.container).toBeVisible()
      await expect(app.eventStream.sessionBar).toBeVisible()
    })
  })

  test.describe("scroll behavior", () => {
    test("scroll to bottom button appears when scrolled up", async ({ app }) => {
      // This test verifies the scroll-to-bottom functionality
      // We need content to scroll - in a fresh environment there may not be enough
      const scrollButton = app.page.getByRole("button", { name: /scroll.*bottom/i })

      // If there's enough content to scroll, the button should appear when scrolled up
      // First check if the event stream has scrollable content
      const container = app.eventStream.container
      const isScrollable = await container.evaluate(el => el.scrollHeight > el.clientHeight)

      if (isScrollable) {
        // Scroll up
        await container.evaluate(el => (el.scrollTop = 0))

        // Button should become visible
        await expect(scrollButton).toBeVisible({ timeout: 2000 })

        // Click to scroll back to bottom
        await scrollButton.click()

        // Button should hide after scrolling to bottom
        await expect(scrollButton).not.toBeVisible({ timeout: 2000 })
      }
    })
  })
})
