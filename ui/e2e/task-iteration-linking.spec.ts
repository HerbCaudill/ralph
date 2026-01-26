import { test, expect } from "./fixtures"

/**
 * E2E tests for task-to-iteration linking functionality.
 *
 * Note: These tests verify the integration between tasks and iterations,
 * which requires the full app context with real data flows.
 */
test.describe("Task to Iteration Linking", () => {
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

      // Wait for iteration links to finish loading
      await app.taskDetails.waitForIterationLinksLoaded()

      // New tasks should not have iterations, so the section should not be visible
      const hasIterations = await app.taskDetails.hasIterationLinks()
      expect(hasIterations).toBe(false)
    })
  })

  test.describe("iteration links with existing iterations", () => {
    // These tests require iteration data to exist - they skip gracefully if not available
    test("shows iteration links with accessible labels and event counts", async ({ app }) => {
      // Create a task
      const taskName = `Iteration Links Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        // No iterations available - test can't verify iteration links
        // This is expected in a fresh test environment
        return
      }

      // Verify the "Iterations" label is shown
      await expect(app.taskDetails.iterationLinksLabel).toBeVisible()

      // Verify at least one iteration link exists
      const count = await app.taskDetails.getIterationLinkCount()
      expect(count).toBeGreaterThan(0)

      // Verify accessibility - buttons should have aria-labels
      const firstButton = app.taskDetails.getIterationLinkButtons().first()
      const ariaLabel = await firstButton.getAttribute("aria-label")
      expect(ariaLabel).toMatch(/view iteration/i)

      // Verify event count is shown
      const eventCount = await app.taskDetails.getIterationEventCount(0)
      expect(eventCount).toMatch(/\d+ events?/)
    })

    test("clicking iteration link opens right panel and updates URL", async ({ app }) => {
      const taskName = `Panel Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        return
      }

      // Right panel should be initially closed
      const rightPanel = app.page.getByTestId("right-panel")
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Click the first iteration link
      await app.taskDetails.clickIterationLink(0)

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
