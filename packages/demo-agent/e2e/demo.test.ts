import { test, expect } from "@playwright/test"

test.describe("Agent Chat Demo", () => {
  test("user can type and send a message", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Connected")).toBeVisible()

    const input = page.getByPlaceholder("Send a message…")
    await expect(input).toBeVisible()

    const prompt = "what is 2+2?"

    await input.fill(prompt)
    await input.press("Enter")

    // The user message should appear in the event display
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText(prompt)

    // The 'Processing' indicator should appear
    await expect(page.getByRole("contentinfo")).toContainText("Processing")

    // the 'Processing' indicator should disappear when done
    await expect(page.getByRole("contentinfo")).not.toContainText("Processing")

    // The agent's response should appear in the event display
    await expect(page.getByRole("log", { name: "Agent Events" })).toContainText("4")
  })
})
