import { test, expect } from "./fixtures"

test("displays main layout with sidebar and content", async ({ app }) => {
  // Check for sidebar
  await expect(app.taskList.sidebar).toBeVisible()

  // Check for event stream
  await expect(app.eventStream.container).toBeVisible()

  // Check for chat input
  await expect(app.chat.messageInput).toBeVisible()

  // Check for control bar at bottom (by checking for the Start button)
  await expect(app.page.getByRole("button", { name: "Start" })).toBeVisible()
})

test("can toggle sidebar", async ({ app }) => {
  // Sidebar should be visible initially
  await expect(app.taskList.sidebar).toBeVisible()

  // Use keyboard shortcut to collapse sidebar
  await app.toggleSidebar()

  // Sidebar content should be hidden
  await expect(app.taskList.sidebar).not.toBeVisible()

  // Use keyboard shortcut to expand sidebar again
  await app.toggleSidebar()

  // Sidebar should be visible again
  await expect(app.taskList.sidebar).toBeVisible()
})
