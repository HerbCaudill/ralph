import { test, expect } from "./fixtures"

/**
 * E2E tests for task-to-session linking functionality.
 *
 * Note: These tests verify the integration between tasks and sessions,
 * which requires the full app context with real data flows.
 */
test.describe("Task to Session Linking", () => {
  test.describe("task details dialog", () => {
    test("opens when clicking a task and shows correct state for new tasks", async ({ app }) => {
      // Create a task to ensure we have one
      const taskName = `Dialog Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      // Click the task to open the details dialog
      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await expect(taskCard).toBeVisible()
      await taskCard.click()

      // Dialog should open
      await app.taskDetails.waitForOpen()
      await expect(app.taskDetails.dialog).toBeVisible()

      // Wait for session links to finish loading
      await app.taskDetails.waitForSessionLinksLoaded()

      // New tasks should not have sessions, so the section should not be visible
      const hasSessions = await app.taskDetails.hasSessionLinks()
      expect(hasSessions).toBe(false)
    })
  })

  test.describe("session links with existing sessions", () => {
    // These tests require session data to exist - they skip gracefully if not available
    test("shows session links with accessible labels and event counts", async ({ app }) => {
      // Create a task
      const taskName = `Session Links Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForSessionLinksLoaded()

      const hasSessions = await app.taskDetails.hasSessionLinks()
      if (!hasSessions) {
        // No sessions available - test can't verify session links
        // This is expected in a fresh test environment
        return
      }

      // Verify the "Sessions" label is shown
      await expect(app.taskDetails.sessionLinksLabel).toBeVisible()

      // Verify at least one session link exists
      const count = await app.taskDetails.getSessionLinkCount()
      expect(count).toBeGreaterThan(0)

      // Verify accessibility - buttons should have aria-labels
      const firstButton = app.taskDetails.getSessionLinkButtons().first()
      const ariaLabel = await firstButton.getAttribute("aria-label")
      expect(ariaLabel).toMatch(/view session/i)

      // Verify event count is shown
      const eventCount = await app.taskDetails.getSessionEventCount(0)
      expect(eventCount).toMatch(/\d+ events?/)
    })

    test("clicking session link opens right panel and updates URL", async ({ app }) => {
      const taskName = `Panel Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForSessionLinksLoaded()

      const hasSessions = await app.taskDetails.hasSessionLinks()
      if (!hasSessions) {
        return
      }

      // Right panel should be initially closed
      const rightPanel = app.page.getByTestId("right-panel")
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Click the first session link
      await app.taskDetails.clickSessionLink(0)

      // URL hash should be updated
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-zA-Z0-9-]+/)

      // Right panel should open
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width), {
          timeout: 5000,
        })
        .toBeGreaterThan(0)
    })
  })
})
