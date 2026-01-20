import { test, expect } from "@playwright/test"

test("displays main layout with sidebar and content", async ({ page }) => {
  await page.goto("/")

  // Check for sidebar (TaskSidebar is a pure layout component without heading)
  await expect(page.getByRole("complementary", { name: "Task sidebar" })).toBeVisible()

  // Check for event stream
  await expect(page.getByRole("log", { name: "Event stream" })).toBeVisible()

  // Check for chat input
  await expect(page.getByRole("textbox", { name: "Message input" })).toBeVisible()

  // Check for status bar at bottom (by checking for the control buttons)
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible()
})

test("can toggle sidebar", async ({ page }) => {
  await page.goto("/")

  // Sidebar should be visible initially
  await expect(page.getByRole("complementary", { name: "Task sidebar" })).toBeVisible()

  // Use keyboard shortcut to collapse sidebar (Cmd+B on Mac, Ctrl+B on Windows/Linux)
  await page.keyboard.press("Meta+b")

  // Sidebar content should be hidden
  await expect(page.getByRole("complementary", { name: "Task sidebar" })).not.toBeVisible()

  // Use keyboard shortcut to expand sidebar again
  await page.keyboard.press("Meta+b")

  // Sidebar should be visible again
  await expect(page.getByRole("complementary", { name: "Task sidebar" })).toBeVisible()
})
