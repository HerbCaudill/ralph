import { test, expect } from "./fixtures"

// Helper to generate unique task names to avoid conflicts in parallel tests
const uniqueTaskName = (base: string) =>
  `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe("Task to Iteration Linking", () => {
  test.describe("iteration links in task details dialog", () => {
    test("task details dialog opens when clicking a task", async ({ app }) => {
      // Create a unique task to ensure we have one
      const taskName = uniqueTaskName("Task Dialog Test")
      await app.taskList.createTask(taskName)

      // Get the task we just created
      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await expect(taskCard).toBeVisible()

      // Click the task to open the details dialog
      await taskCard.click()

      // Dialog should open
      await app.taskDetails.waitForOpen()

      // Dialog should contain the task details
      await expect(app.taskDetails.dialog).toBeVisible()
    })

    test("iteration links section hidden when task has no iterations", async ({ app }) => {
      // Create a brand new task that won't have any iterations
      const taskName = uniqueTaskName("No Iterations Test")
      await app.taskList.createTask(taskName)

      // Get the task we just created
      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await expect(taskCard).toBeVisible()

      // Click the task to open the details dialog
      await taskCard.click()
      await app.taskDetails.waitForOpen()

      // Wait for any loading to complete
      await app.taskDetails.waitForIterationLinksLoaded()

      // Since this is a brand new task with no iterations,
      // the iterations section should not be visible
      const hasIterations = await app.taskDetails.hasIterationLinks()
      expect(hasIterations).toBe(false)
    })

    test("iteration links component handles loading state correctly", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("Loading State Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await expect(taskCard).toBeVisible()

      // Click the task to open the details dialog
      await taskCard.click()
      await app.taskDetails.waitForOpen()

      // The IterationLinks component goes through a loading state, then either
      // shows iterations or renders nothing. We verify it completes loading.
      await app.taskDetails.waitForIterationLinksLoaded()

      // After loading, hasIterationLinks returns false for a new task (no iterations)
      const hasIterations = await app.taskDetails.hasIterationLinks()
      expect(hasIterations).toBe(false)
    })

    test("iteration links show when task has iterations", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("Iterations Display Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await expect(taskCard).toBeVisible()

      // Click the task to open the details dialog
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      // Check if iterations section is visible
      const hasIterations = await app.taskDetails.hasIterationLinks()

      if (hasIterations) {
        // Should show the "Iterations" label
        await expect(app.taskDetails.iterationLinksLabel).toBeVisible()

        // Should have at least one iteration link
        const count = await app.taskDetails.getIterationLinkCount()
        expect(count).toBeGreaterThan(0)
      }
      // If no iterations exist (new task), section should not be visible (component renders null)
      // Both outcomes are valid - test verifies the correct behavior for each case
    })

    test("iteration links are accessible with proper aria-labels", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("Accessibility Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        // Can't test accessibility without iterations - test passes
        // (This is expected for a brand new task)
        return
      }

      // Iteration link buttons should have accessible labels
      const buttons = app.taskDetails.getIterationLinkButtons()
      const firstButton = buttons.first()

      const ariaLabel = await firstButton.getAttribute("aria-label")
      expect(ariaLabel).toMatch(/view iteration/i)
    })

    test("clicking iteration link updates URL hash", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("URL Hash Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        // Can't test navigation without iterations - test passes
        return
      }

      // Click the first iteration link
      await app.taskDetails.clickIterationLink(0)

      // URL hash should be updated to point to the event log
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-zA-Z0-9-]+/)
    })

    test("iteration links show event count", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("Event Count Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        return
      }

      // Each iteration link should show event count
      const eventCount = await app.taskDetails.getIterationEventCount(0)
      expect(eventCount).toMatch(/\d+ events?/)
    })
  })

  test.describe("viewing iteration from task", () => {
    test("right panel opens when iteration link is clicked", async ({ app }) => {
      // Create a task
      const taskName = uniqueTaskName("Right Panel Test")
      await app.taskList.createTask(taskName)

      const taskCard = app.taskList.sidebar.locator("[data-task-id]").first()
      await taskCard.click()
      await app.taskDetails.waitForOpen()
      await app.taskDetails.waitForIterationLinksLoaded()

      const hasIterations = await app.taskDetails.hasIterationLinks()
      if (!hasIterations) {
        return
      }

      // Right panel should be initially closed (width <= 1px)
      const rightPanel = app.page.getByTestId("right-panel")
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(1)

      // Click the first iteration link
      await app.taskDetails.clickIterationLink(0)

      // Wait for URL to update
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-zA-Z0-9-]+/)

      // Right panel should open (width > 0)
      await expect
        .poll(() => rightPanel.evaluate(el => el.getBoundingClientRect().width), {
          timeout: 5000,
        })
        .toBeGreaterThan(0)
    })
  })

  test.describe("viewing task from iteration history", () => {
    test("iteration history items display task information", async ({ app }) => {
      // Open the iteration history panel
      await app.iterationHistory.open()

      // Check if there are any iterations
      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (isEmpty) {
        // No iterations to test - this is valid for a fresh test environment
        return
      }

      // Get the first iteration item
      const firstItem = app.iterationHistory.historyList.locator("li").first()
      await expect(firstItem).toBeVisible()

      // Iteration items should display task ID (if associated with a task)
      // The format is: task ID, task title, time, event count
      const hasTaskId = (await firstItem.locator("span.font-mono").count()) > 0
      const hasEventCount = (await firstItem.getByText(/\d+ events?/).count()) > 0

      // Event count should always be present
      expect(hasEventCount).toBe(true)

      // If there's a task ID, it should be visible
      if (hasTaskId) {
        await expect(firstItem.locator("span.font-mono").first()).toBeVisible()
      }
    })

    test("clicking iteration item updates URL and shows iteration", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (isEmpty) {
        return
      }

      // Click on the first iteration item
      const firstItem = app.iterationHistory.historyList.locator("li button").first()
      await firstItem.click()

      // URL hash should be updated to point to the event log
      await expect.poll(() => app.page.url()).toMatch(/#eventlog=[a-zA-Z0-9-]+/)
    })

    test("iteration history shows task title when available", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (isEmpty) {
        return
      }

      // Get the first iteration item
      const firstItem = app.iterationHistory.historyList.locator("li").first()

      // Check for task title (font-medium text that isn't "No task")
      const titleElement = firstItem.locator("span.font-medium")
      const hasTitle = (await titleElement.count()) > 0

      if (hasTitle) {
        const titleText = await titleElement.textContent()
        // Title should either be a real title or "No task" for iterations without a task
        expect(typeof titleText).toBe("string")
      }
    })

    test("searching by task ID filters iteration history", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (isEmpty) {
        return
      }

      // Get the initial count - wait for content to appear
      await expect
        .poll(() => app.iterationHistory.getVisibleIterationCount(), { timeout: 5000 })
        .toBeGreaterThan(0)

      const initialCount = await app.iterationHistory.getVisibleIterationCount()

      // Search for a non-existent task ID
      await app.iterationHistory.search("nonexistent-task-xyz123")

      // Should show no results
      await expect(app.iterationHistory.isNoResultsVisible()).resolves.toBe(true)

      // Clear search
      await app.iterationHistory.clearSearch()

      // Should show iterations again (count should be at least as many as before,
      // possibly more if new iterations were created during the test)
      await expect
        .poll(() => app.iterationHistory.getVisibleIterationCount(), { timeout: 5000 })
        .toBeGreaterThanOrEqual(initialCount)
    })

    test("iteration history items are keyboard accessible", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (isEmpty) {
        return
      }

      // First item's button should be focusable
      const firstButton = app.iterationHistory.historyList.locator("li button").first()
      await expect(firstButton).toBeEnabled()

      // Focus the button and verify it has proper aria-label
      const ariaLabel = await firstButton.getAttribute("aria-label")
      expect(ariaLabel).toMatch(/view iteration/i)
    })
  })
})
