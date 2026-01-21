import { test, expect } from "./fixtures"

test.describe("QuickTaskInput", () => {
  test("clears input after successful task submission", async ({ app }) => {
    const taskTitle = `E2E Test Task ${Date.now()}`

    // Focus on the quick task input
    await app.taskList.quickTaskInput.click()
    await expect(app.taskList.quickTaskInput).toBeFocused()

    // Type a task title
    await app.taskList.quickTaskInput.fill(taskTitle)
    await expect(app.taskList.quickTaskInput).toHaveValue(taskTitle)

    // Submit the task by pressing Enter
    await app.taskList.quickTaskInput.press("Enter")

    // Wait for the task to appear in the list (confirming creation succeeded)
    await expect(app.page.getByText(taskTitle)).toBeVisible({ timeout: 10000 })

    // Wait for the input to be enabled (submission complete)
    await expect(app.taskList.quickTaskInput).toBeEnabled({ timeout: 5000 })

    // The input should be cleared after successful submission
    await expect(app.taskList.quickTaskInput).toHaveValue("")
  })

  test("clears localStorage draft after successful task submission", async ({ app }) => {
    const taskTitle = `E2E Storage Test ${Date.now()}`

    // Type a task title
    await app.taskList.quickTaskInput.fill(taskTitle)

    // Verify localStorage has the draft
    const storedValue = await app.page.evaluate(() =>
      localStorage.getItem("ralph-ui-task-input-draft"),
    )
    expect(storedValue).toBe(taskTitle)

    // Submit the task
    await app.taskList.quickTaskInput.press("Enter")

    // Wait for the task to appear in the list
    await expect(app.page.getByText(taskTitle)).toBeVisible({ timeout: 10000 })

    // Wait for input to be cleared (indicates submission completed)
    await expect(app.taskList.quickTaskInput).toHaveValue("")

    // localStorage should be cleared
    const clearedValue = await app.page.evaluate(() =>
      localStorage.getItem("ralph-ui-task-input-draft"),
    )
    expect(clearedValue).toBeNull()
  })

  test("retains focus on input after successful submission", async ({ app }) => {
    const taskTitle = `E2E Focus Test ${Date.now()}`

    // Focus and type
    await app.taskList.quickTaskInput.click()
    await app.taskList.quickTaskInput.fill(taskTitle)

    // Submit the task
    await app.taskList.quickTaskInput.press("Enter")

    // Wait for the task to appear
    await expect(app.page.getByText(taskTitle)).toBeVisible({ timeout: 10000 })

    // Input should still be focused (or re-focused) after submission
    await expect(app.taskList.quickTaskInput).toBeFocused()
  })

  test("keeps input value on API error", async ({ app }) => {
    // Mock the API to return an error
    await app.page.route("/api/tasks", async route => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Server error" }),
        })
      } else {
        await route.continue()
      }
    })

    const taskTitle = `E2E Error Test ${Date.now()}`

    // Type a task title
    await app.taskList.quickTaskInput.fill(taskTitle)

    // Try to submit the task
    await app.taskList.quickTaskInput.press("Enter")

    // Wait a bit for the error response
    await app.page.waitForTimeout(500)

    // Input should retain the value on error
    await expect(app.taskList.quickTaskInput).toHaveValue(taskTitle)
  })
})
