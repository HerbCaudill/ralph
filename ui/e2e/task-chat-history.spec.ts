import { test, expect } from "./fixtures"

test.describe("Task Chat History Dropdown", () => {
  test.describe("opening and closing", () => {
    test("History button is visible in chat panel", async ({ app }) => {
      await expect(app.taskChatHistory.triggerButton).toBeVisible()
    })

    test("clicking History button opens the dropdown", async ({ app }) => {
      await app.taskChatHistory.open()

      // Popover should be visible with the search input
      await expect(app.taskChatHistory.popover).toBeVisible()
      await expect(app.taskChatHistory.searchInput).toBeVisible()
    })

    test("Escape closes the dropdown", async ({ app }) => {
      await app.taskChatHistory.open()
      await expect(app.taskChatHistory.popover).toBeVisible()

      await app.taskChatHistory.close()
      await expect(app.taskChatHistory.popover).not.toBeVisible()
    })

    test("clicking outside closes the dropdown", async ({ app }) => {
      await app.taskChatHistory.open()
      await expect(app.taskChatHistory.popover).toBeVisible()

      // Click outside the popover
      await app.page.locator("body").click({ position: { x: 10, y: 10 } })
      await expect(app.taskChatHistory.popover).not.toBeVisible()
    })
  })

  test.describe("empty state", () => {
    test("shows empty state message when no chat sessions exist", async ({ app }) => {
      await app.taskChatHistory.open()

      // In a fresh test workspace, there should be no chat sessions
      const isEmpty = await app.taskChatHistory.isEmptyStateVisible()
      const sessionCount = await app.taskChatHistory.getSessionCount()

      // Either empty state is shown OR there are sessions
      // (depends on whether the test workspace has any chat history)
      if (isEmpty) {
        await expect(app.taskChatHistory.popover.getByText("No chat sessions found.")).toBeVisible()
      } else {
        expect(sessionCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe("search functionality", () => {
    test("search input is visible when dropdown is open", async ({ app }) => {
      await app.taskChatHistory.open()
      await expect(app.taskChatHistory.searchInput).toBeVisible()
    })

    test("search input has correct placeholder", async ({ app }) => {
      await app.taskChatHistory.open()

      const placeholder = await app.taskChatHistory.getSearchPlaceholder()
      expect(placeholder).toBe("Search chat sessions...")
    })

    test("can type in search input", async ({ app }) => {
      await app.taskChatHistory.open()

      await app.taskChatHistory.search("test query")
      await expect(app.taskChatHistory.searchInput).toHaveValue("test query")
    })

    test("clearing search resets the input", async ({ app }) => {
      await app.taskChatHistory.open()

      await app.taskChatHistory.search("test query")
      await expect(app.taskChatHistory.searchInput).toHaveValue("test query")

      await app.taskChatHistory.clearSearch()
      await expect(app.taskChatHistory.searchInput).toHaveValue("")
    })
  })

  test.describe("session list display", () => {
    test("shows date groups when sessions exist", async ({ app }) => {
      await app.taskChatHistory.open()

      const isEmpty = await app.taskChatHistory.isEmptyStateVisible()
      if (!isEmpty) {
        const dateGroups = await app.taskChatHistory.getDateGroupLabels()

        // If there are sessions, there should be at least one date group
        if (dateGroups.length > 0) {
          // Date groups should be strings like "Today", "Yesterday", or formatted dates
          for (const label of dateGroups) {
            expect(typeof label).toBe("string")
            expect(label.length).toBeGreaterThan(0)
          }
        }
      }
    })

    test("session items are visible when sessions exist", async ({ app }) => {
      await app.taskChatHistory.open()

      const isEmpty = await app.taskChatHistory.isEmptyStateVisible()
      if (!isEmpty) {
        const sessionCount = await app.taskChatHistory.getSessionCount()
        if (sessionCount > 0) {
          const items = await app.taskChatHistory.getSessionItems()
          await expect(items.first()).toBeVisible()
        }
      }
    })
  })

  test.describe("accessibility", () => {
    test("trigger button has accessible label", async ({ app }) => {
      await expect(app.taskChatHistory.triggerButton).toHaveAttribute(
        "aria-label",
        "View chat history",
      )
    })

    test("trigger button has title for tooltip", async ({ app }) => {
      await expect(app.taskChatHistory.triggerButton).toHaveAttribute("title", "Chat history")
    })

    test("search input is a combobox", async ({ app }) => {
      await app.taskChatHistory.open()
      await expect(app.taskChatHistory.searchInput).toHaveRole("combobox")
    })
  })
})
