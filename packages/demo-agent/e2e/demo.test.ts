import { test, expect } from "@playwright/test"

test.describe("Agent Chat Demo", () => {
  test("page loads and shows title", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Agent Chat Demo")).toBeVisible()
  })

  test("WebSocket connects and status bar shows Connected", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 10000 })
  })

  test("user can type and send a message", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 10000 })

    const input = page.getByPlaceholder("Send a message…")
    await expect(input).toBeVisible()
    await input.fill("Hello, what is 2 + 2?")
    await input.press("Enter")

    // The user message should appear in the event display
    await expect(page.getByText("Hello, what is 2 + 2?")).toBeVisible({ timeout: 5000 })
  })

  test("does not get stuck in processing state forever", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Connected")).toBeVisible({ timeout: 10000 })

    const input = page.getByPlaceholder("Send a message…")
    await input.fill("Say hello")
    await input.press("Enter")

    // Wait for processing to start (input becomes disabled)
    await expect(input).toBeDisabled({ timeout: 5000 })

    // Should eventually leave the processing state — either a response arrives
    // or an error appears, but it shouldn't hang indefinitely.
    // We check that the input becomes enabled again (streaming = false).
    await expect(input).toBeEnabled({ timeout: 45000 })
  })
})
