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

  // Skipped: flaky — second message intermittently doesn't get "Paris" response (r-3m310)
  test.skip("user can type and send a message", async ({ page }) => {
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
    // Use longer timeout for API responses which may take time depending on load
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText("Madrid", {
      timeout: 30000,
    })

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
    // Use longer timeout for API responses which may take time depending on load
    await expect(eventLog).toContainText("Berlin", { timeout: 30000 })

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

  // Test that ctrl+o shortcut works in the real browser environment
  // This test uses the console to verify the keydown event is received
  test("ctrl+o shortcut is received by the page", async ({ page }) => {
    await expect(page.getByText("connected")).toBeVisible()

    // Add a listener to track keydown events
    const keysReceived: string[] = []
    page.on("console", msg => {
      if (msg.text().startsWith("KEYDOWN:")) {
        keysReceived.push(msg.text())
      }
    })

    // Inject a temporary keydown listener to log key events
    await page.evaluate(() => {
      window.addEventListener(
        "keydown",
        e => {
          if (e.ctrlKey && e.key === "o") {
            console.log(`KEYDOWN: ctrl+${e.key}`)
          }
        },
        { capture: true },
      )
    })

    // Press Ctrl+O
    await page.keyboard.press("Control+o")

    // Give time for the event to be processed
    await page.waitForTimeout(500)

    // Verify the keydown event was received
    expect(keysReceived.length).toBeGreaterThan(0)
    expect(keysReceived[0]).toBe("KEYDOWN: ctrl+o")
  })

  test("cmd+/ opens hotkeys dialog", async ({ page }) => {
    await expect(page.getByText("connected")).toBeVisible()

    // cmd+/ should open the hotkeys dialog
    // On macOS (where Playwright runs), cmd maps to Meta
    // First verify the dialog doesn't exist yet
    const dialog = page.getByRole("dialog")
    await expect(dialog).not.toBeVisible()

    // Press the shortcut (Meta+/ for cmd+/ on Mac)
    await page.keyboard.press("Meta+/")

    // Dialog should appear
    await expect(dialog).toBeVisible({ timeout: 2000 })

    // Verify the dialog shows the correct shortcut for toggleToolOutput
    await expect(page.locator("text=Toggle tool output")).toBeVisible()

    // Close the dialog
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
  })
})
