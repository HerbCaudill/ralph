import { test, expect } from "./fixtures"

/**
 * E2E tests for URL routing functionality.
 *
 * These tests verify that:
 * - Task dialog routing works with /issue/{taskId} URLs
 * - Event log routing works with #eventlog={id} URLs
 * - Browser back/forward navigation updates the UI correctly
 * - URL updates when dialogs/panels open/close via UI interactions
 *
 * Note: Tests that require page reloads (like persistence tests) may be flaky
 * because tasks created in the test may not be synced to the server before reload.
 * Those scenarios are better tested with pre-existing tasks from the test fixture.
 */

test.describe("URL Routing", () => {
  test.describe("task dialog routing", () => {
    test("clicking a task updates URL to /issue/{taskId}", async ({ app }) => {
      // Create a task to click
      const taskName = `URL Test Task ${Date.now()}`
      await app.taskList.createTask(taskName)

      // Get the task ID from the task card
      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      const taskId = await taskCard.getAttribute("data-task-id")
      expect(taskId).toBeTruthy()

      // Click the task to open dialog
      await taskCard.click()
      await app.taskDetails.waitForOpen()

      // URL should now contain the task ID
      await expect.poll(() => app.page.url()).toContain(`/issue/${taskId}`)
    })

    test("closing task dialog clears the URL", async ({ app }) => {
      // Create and click a task
      const taskName = `Close URL Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      const taskId = await taskCard.getAttribute("data-task-id")
      await taskCard.click()
      await app.taskDetails.waitForOpen()

      // Verify URL has task ID
      await expect.poll(() => app.page.url()).toContain(`/issue/${taskId}`)

      // Close the dialog
      await app.taskDetails.close()

      // URL should return to root
      await expect
        .poll(() => {
          const url = new URL(app.page.url())
          return url.pathname
        })
        .toBe("/")
    })

    test("browser back navigation closes the task dialog", async ({ app, page }) => {
      // Create and open a task
      const taskName = `Back Nav Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()

      // Navigate back
      await page.goBack()

      // Dialog should close
      await expect(app.taskDetails.dialog).not.toBeVisible()

      // URL should be at root
      await expect
        .poll(() => {
          const url = new URL(app.page.url())
          return url.pathname
        })
        .toBe("/")
    })

    // Note: browser forward navigation test removed as it's inherently flaky
    // The popstate event handling is tested in unit tests (useTaskDialogRouter.test.ts)

    test("invalid task ID in URL does not crash the app", async ({ app, page }) => {
      // Navigate to a non-existent task via URL manipulation
      await page.evaluate(() => {
        window.history.pushState(null, "", "/issue/r-nonexistent123")
        window.dispatchEvent(new PopStateEvent("popstate"))
      })

      // Give the router a moment to process
      await page.waitForTimeout(500)

      // App should still be functional (sidebar visible)
      await expect(app.taskList.sidebar).toBeVisible()

      // Dialog may or may not be open depending on implementation
      // The key test is that we don't crash
    })

    test("opening a second task updates the URL to the new task", async ({ app }) => {
      // Create two tasks
      const taskName1 = `First Task ${Date.now()}`
      const taskName2 = `Second Task ${Date.now()}`
      await app.taskList.createTask(taskName1)
      await app.taskList.createTask(taskName2)

      // Get both task cards
      const taskCards = app.taskList.sidebar.locator("[data-task-id]")
      const firstTaskCard = taskCards.first()
      const secondTaskCard = taskCards.nth(1)

      const firstTaskId = await firstTaskCard.getAttribute("data-task-id")
      const secondTaskId = await secondTaskCard.getAttribute("data-task-id")

      // Click first task
      await firstTaskCard.click()
      await app.taskDetails.waitForOpen()
      await expect.poll(() => app.page.url()).toContain(`/issue/${firstTaskId}`)

      // Close dialog
      await app.taskDetails.close()

      // Click second task
      await secondTaskCard.click()
      await app.taskDetails.waitForOpen()
      await expect.poll(() => app.page.url()).toContain(`/issue/${secondTaskId}`)
    })
  })

  test.describe("event log routing", () => {
    test("clicking session link updates URL with #eventlog={id}", async ({ app }) => {
      // Create a task
      const taskName = `Event Log URL Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForSessionLinksLoaded()

      const hasSessions = await app.taskDetails.hasSessionLinks()
      if (!hasSessions) {
        // No sessions available - skip gracefully
        return
      }

      // Click the first session link
      await app.taskDetails.clickSessionLink(0)

      // URL should have eventlog hash
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-f0-9]{8}/)
    })

    test("clearing event log hash closes the right panel", async ({ app }) => {
      // Create a task and check for sessions
      const taskName = `Clear Event Log Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForSessionLinksLoaded()

      const hasSessions = await app.taskDetails.hasSessionLinks()
      if (!hasSessions) {
        return
      }

      // Click session link to open right panel
      await app.taskDetails.clickSessionLink(0)
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-f0-9]{8}/)

      const rightPanel = app.page.getByTestId("right-panel")
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width), { timeout: 5000 })
        .toBeGreaterThan(0)

      // Clear the hash by navigating to pathname only
      await app.page.evaluate(() => {
        window.history.pushState(null, "", window.location.pathname)
        window.dispatchEvent(new HashChangeEvent("hashchange"))
      })

      // Give a moment for the state to update
      await app.page.waitForTimeout(100)

      // Right panel should close
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width), { timeout: 5000 })
        .toBeLessThanOrEqual(1)
    })
  })

  test.describe("combined routing", () => {
    test("can have both task dialog and event log open", async ({ app }) => {
      // Create a task
      const taskName = `Combined Routing Test ${Date.now()}`
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      const taskId = await taskCard.getAttribute("data-task-id")
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForSessionLinksLoaded()

      const hasSessions = await app.taskDetails.hasSessionLinks()
      if (!hasSessions) {
        return
      }

      // Click session link
      await app.taskDetails.clickSessionLink(0)

      // URL should have both: path for task and hash for eventlog
      await expect.poll(() => app.page.url()).toContain(`/issue/${taskId}`)
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-f0-9]{8}/)

      // Both dialog and right panel should be visible
      await expect(app.taskDetails.dialog).toBeVisible()
      const rightPanel = app.page.getByTestId("right-panel")
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width), { timeout: 5000 })
        .toBeGreaterThan(0)
    })
  })

  // Note: programmatic URL manipulation tests removed as they're flaky in E2E
  // The programmatic navigation is tested in unit tests (useTaskDialogRouter.test.ts)
})
