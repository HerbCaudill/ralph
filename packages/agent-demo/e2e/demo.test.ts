import { test, expect } from "@playwright/test"

test.describe("Agent Chat Demo", () => {
  // Clear localStorage before each test to ensure test isolation
  test.beforeEach(async ({ page }) => {
    // Navigate first so we have access to localStorage for this origin
    await page.goto("/")
    await page.evaluate(() => localStorage.clear())
    // Reload so the app initializes with cleared storage
    await page.reload()
  })

  test("user can type and send a message", async ({ page }) => {
    await expect(page.getByText("connected")).toBeVisible()

    const input = page.getByPlaceholder("Send a message…")
    await expect(input).toBeVisible()

    const prompt = "what is the capital of Spain"

    await input.fill(prompt)
    await input.press("Enter")

    // The user message should appear in the event display
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText(prompt)

    // Input should be cleared after sending
    await expect(input).toHaveValue("")

    // The agent's response should include "Madrid"
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText("Madrid")

    // Wait for streaming to complete before sending the next message
    // The spinner should disappear when streaming is done
    await expect(page.locator(".animate-spin")).toBeHidden({ timeout: 30000 })

    const prompt2 = "what about France"

    await input.fill(prompt2)
    await input.press("Enter")

    // The user message should appear in the event display
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText(prompt2)

    // Input should be cleared after sending
    await expect(input).toHaveValue("")

    // The agent's response should include "Paris"
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText("Paris", {
      timeout: 30000,
    })
  })

  test("session persists across page reload", async ({ page }) => {
    await expect(page.getByText("connected")).toBeVisible()

    const input = page.getByPlaceholder("Send a message…")
    await expect(input).toBeVisible()

    const prompt = "what is the capital of Germany"

    await input.fill(prompt)
    await input.press("Enter")

    const eventLog = page.getByRole("log", { name: "Agent Events" })

    // Wait for the user message to appear
    await expect(eventLog).toContainText(prompt)

    // Wait for the agent's response
    await expect(eventLog).toContainText("Berlin")

    // Reload the page
    await page.reload()

    // Wait for reconnection
    await expect(page.getByText("connected")).toBeVisible()

    // Previous events should still be visible after reload
    await expect(eventLog).toContainText(prompt)
    await expect(eventLog).toContainText("Berlin")
  })

  test("input receives focus after clicking New session button", async ({ page }) => {
    await expect(page.getByText("connected")).toBeVisible()

    const input = page.getByPlaceholder("Send a message…")
    await expect(input).toBeVisible()

    // Click on something else first to ensure input doesn't have focus
    await page.getByRole("button", { name: "Settings" }).click()
    // Close the menu by pressing Escape
    await page.keyboard.press("Escape")

    // Verify input is not focused
    await expect(input).not.toBeFocused()

    // Click the New session button
    await page.getByRole("button", { name: "New session" }).click()

    // Input should be focused after clicking New session
    await expect(input).toBeFocused()
  })
})
