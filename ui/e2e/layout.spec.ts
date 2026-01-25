import { test, expect } from "./fixtures"

/**
 * E2E tests for layout behavior that requires full app context.
 *
 * Note: Simple visibility/presence tests have been migrated to Storybook:
 * - Header.stories.tsx (logo, workspace picker, settings dropdown)
 * - TaskSidebar.stories.tsx (sidebar, quick task input)
 * - MainLayout.stories.tsx (event stream, chat input, control bar, panels)
 *
 * Panel toggle (Cmd+J) is tested in navigation.spec.ts
 */
test.describe("Layout", () => {
  test("settings dropdown shows theme controls", async ({ app }) => {
    const settingsDropdown = app.page.getByTestId("settings-dropdown-trigger")

    // Open settings dropdown
    await settingsDropdown.click()

    // Appearance mode buttons should be visible
    await expect(app.page.getByTestId("settings-appearance-system")).toBeVisible()
    await expect(app.page.getByTestId("settings-appearance-light")).toBeVisible()
    await expect(app.page.getByTestId("settings-appearance-dark")).toBeVisible()

    // Can change theme by clicking an appearance mode button
    await app.page.getByTestId("settings-appearance-light").click()

    // Dropdown should remain open
    await expect(app.page.getByTestId("settings-dropdown")).toBeVisible()
  })

  test("Cmd+B toggles sidebar", async ({ app }) => {
    // Sidebar should be visible initially
    await expect(app.taskList.sidebar).toBeVisible()

    // Toggle sidebar off
    await app.toggleSidebar()
    await expect(app.taskList.sidebar).not.toBeVisible()

    // Toggle sidebar back on
    await app.toggleSidebar()
    await expect(app.taskList.sidebar).toBeVisible()
  })
})
