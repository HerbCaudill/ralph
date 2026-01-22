import { test, expect } from "./fixtures"

// Run these tests serially since they create tasks which modifies shared state
test.describe.configure({ mode: "serial" })

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

    // Wait for the input to be cleared first (indicates API call succeeded)
    // The input is cleared synchronously via flushSync before the task list refreshes
    await expect(app.taskList.quickTaskInput).toHaveValue("", { timeout: 10000 })

    // Now verify the task appeared in the task list
    await expect(app.taskList.sidebar.locator("span.truncate", { hasText: taskTitle })).toBeVisible(
      { timeout: 10000 },
    )
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

    // Wait for input to be cleared first (indicates API call succeeded)
    await expect(app.taskList.quickTaskInput).toHaveValue("", { timeout: 10000 })

    // localStorage should be cleared (this happens before setTitle(""))
    const clearedValue = await app.page.evaluate(() =>
      localStorage.getItem("ralph-ui-task-input-draft"),
    )
    expect(clearedValue).toBeNull()

    // Verify the task appeared in the task list
    await expect(app.taskList.sidebar.locator("span.truncate", { hasText: taskTitle })).toBeVisible(
      { timeout: 10000 },
    )
  })

  test("retains focus on input after successful submission", async ({ app }) => {
    const taskTitle = `E2E Focus Test ${Date.now()}`

    // Focus and type
    await app.taskList.quickTaskInput.click()
    await app.taskList.quickTaskInput.fill(taskTitle)

    // Submit the task
    await app.taskList.quickTaskInput.press("Enter")

    // Wait for submission to complete - input should be enabled and cleared
    await expect(app.taskList.quickTaskInput).toBeEnabled({ timeout: 10000 })
    await expect(app.taskList.quickTaskInput).toHaveValue("", { timeout: 10000 })

    // Focus happens via setTimeout after submission, so give it time to complete
    await expect(app.taskList.quickTaskInput).toBeFocused({ timeout: 5000 })

    // Verify the task appeared in the task list
    await expect(app.taskList.sidebar.locator("span.truncate", { hasText: taskTitle })).toBeVisible(
      { timeout: 10000 },
    )
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

    // Input should retain the value on error - toHaveValue auto-retries
    // Use a longer timeout to account for the error response processing
    await expect(app.taskList.quickTaskInput).toHaveValue(taskTitle, { timeout: 5000 })
  })
})
