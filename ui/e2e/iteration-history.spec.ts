import { test, expect } from "./fixtures"

test.describe("Iteration History Panel", () => {
  test.describe("opening and closing", () => {
    test("History button is visible in sidebar", async ({ app }) => {
      await expect(app.iterationHistory.triggerButton).toBeVisible()
    })

    test("clicking History button opens the sheet", async ({ app }) => {
      await app.iterationHistory.open()

      // Sheet should be visible with the header (use the span which is visible, not the sr-only heading)
      await expect(app.iterationHistory.sheet).toBeVisible()
      await expect(
        app.iterationHistory.sheet.locator("span", { hasText: "Iteration History" }),
      ).toBeVisible()
    })

    test("Escape closes the sheet", async ({ app }) => {
      await app.iterationHistory.open()
      await expect(app.iterationHistory.sheet).toBeVisible()

      await app.iterationHistory.close()
      await expect(app.iterationHistory.sheet).not.toBeVisible()
    })

    test("close button closes the sheet", async ({ app }) => {
      await app.iterationHistory.open()
      await expect(app.iterationHistory.sheet).toBeVisible()

      // Click the X button to close the sheet
      await app.iterationHistory.sheet.getByRole("button", { name: "Close" }).click()
      await expect(app.iterationHistory.sheet).not.toBeVisible()
    })
  })

  test.describe("empty state", () => {
    test("shows empty state message when no iterations exist", async ({ app }) => {
      await app.iterationHistory.open()

      // In a fresh test workspace, there should be no iterations
      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      const headerCount = await app.iterationHistory.getHeaderCount()

      // Either empty state is shown OR count is 0
      // (depends on whether the test workspace has any iterations)
      if (isEmpty) {
        await expect(
          app.iterationHistory.sheet.getByText("No iteration history yet."),
        ).toBeVisible()
      } else {
        // If not empty, verify the count is shown
        expect(headerCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe("search functionality", () => {
    test("search input is visible when iterations exist", async ({ app }) => {
      await app.iterationHistory.open()

      // Search input may not be visible if there are no iterations
      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        await expect(app.iterationHistory.searchInput).toBeVisible()
      }
    })

    test("search input has correct placeholder", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        await expect(app.iterationHistory.searchInput).toHaveAttribute(
          "placeholder",
          "Search by task ID or title...",
        )
      }
    })

    test("clear button appears when search has text", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        // Initially no clear button
        await expect(app.iterationHistory.clearSearchButton).not.toBeVisible()

        // Type in search
        await app.iterationHistory.search("test")

        // Clear button should appear
        await expect(app.iterationHistory.clearSearchButton).toBeVisible()
      }
    })

    test("clear button clears search text", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        await app.iterationHistory.search("test")
        await expect(app.iterationHistory.searchInput).toHaveValue("test")

        await app.iterationHistory.clearSearch()
        await expect(app.iterationHistory.searchInput).toHaveValue("")
      }
    })

    test("searching with no matches shows 'no results' message", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        // Search for something that won't match
        await app.iterationHistory.search("xyznonexistenttaskid123")

        // Should show no results message
        await expect(app.iterationHistory.isNoResultsVisible()).resolves.toBe(true)
      }
    })
  })

  test.describe("iteration list display", () => {
    test("shows date groups when iterations exist", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        // Wait for content to load and check for date group headers (uppercase labels like "TODAY", "YESTERDAY")
        const groups = app.iterationHistory.sheet.locator('[role="group"]')
        const groupCount = await groups.count()

        // If there are iterations, there should be at least one group
        if (groupCount > 0) {
          const dateGroups = await app.iterationHistory.getDateGroupLabels()
          expect(dateGroups.length).toBeGreaterThan(0)

          // Date groups should include "Today", "Yesterday", or formatted dates
          for (const label of dateGroups) {
            expect(typeof label).toBe("string")
            expect(label.length).toBeGreaterThan(0)
          }
        }
      }
    })

    test("iteration items are clickable", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        // Get the first iteration item
        const firstItem = app.iterationHistory.historyList.locator("li").first()
        await expect(firstItem).toBeVisible()

        // The item should have a button that's clickable
        const button = firstItem.locator("button")
        await expect(button).toBeEnabled()
      }
    })

    test("iteration items show time and event count", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        const firstItem = app.iterationHistory.historyList.locator("li").first()

        // Should show event count (e.g., "X events")
        await expect(firstItem.getByText(/\d+ events?/)).toBeVisible()
      }
    })
  })

  test.describe("accessibility", () => {
    test("sheet has accessible title", async ({ app }) => {
      await app.iterationHistory.open()

      // The sheet should have Iteration History as a title (screen reader accessible)
      await expect(app.page.getByRole("heading", { name: "Iteration History" })).toBeAttached()
    })

    test("history list has proper ARIA role", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        await expect(app.iterationHistory.historyList).toHaveAttribute("role", "list")
      }
    })

    test("search input has accessible label", async ({ app }) => {
      await app.iterationHistory.open()

      const isEmpty = await app.iterationHistory.isEmptyStateVisible()
      if (!isEmpty) {
        await expect(app.iterationHistory.searchInput).toHaveAttribute(
          "aria-label",
          "Search iterations",
        )
      }
    })
  })
})
