import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn, waitFor } from "storybook/test"
import { ThemePickerView } from "./ThemePickerView"
import type { ThemeMeta } from "@/lib/theme"

/**
 * Helper to create mock themes for stories.
 */
function createMockThemes(): ThemeMeta[] {
  return [
    {
      id: "gruvbox-dark",
      label: "Gruvbox Dark",
      type: "dark",
      path: "/path/to/gruvbox-dark.json",
      extensionId: "jdinhlife.gruvbox",
      extensionName: "Gruvbox Theme",
    },
    {
      id: "dracula",
      label: "Dracula",
      type: "dark",
      path: "/path/to/dracula.json",
      extensionId: "dracula-theme.theme-dracula",
      extensionName: "Dracula Official",
    },
    {
      id: "solarized-light",
      label: "Solarized Light",
      type: "light",
      path: "/path/to/solarized-light.json",
      extensionId: "ryanolsonx.solarized",
      extensionName: "Solarized",
    },
    {
      id: "github-light",
      label: "GitHub Light",
      type: "light",
      path: "/path/to/github-light.json",
      extensionId: "github.github-vscode-theme",
      extensionName: "GitHub Theme",
    },
  ]
}

const mockThemes = createMockThemes()

const meta: Meta<typeof ThemePickerView> = {
  title: "Selectors/ThemePicker",
  component: ThemePickerView,
  parameters: {},
  args: {
    themes: mockThemes,
    activeThemeId: null,
    isLoading: false,
    error: null,
    onApplyTheme: fn(),
    onRefresh: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state showing the theme picker button.
 */
export const Default: Story = {}

/**
 * Header variant with custom text color.
 */
export const HeaderVariant: Story = {
  args: {
    variant: "header",
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="rounded-md bg-blue-600 p-4">
        <Story />
      </div>
    ),
  ],
}

/**
 * Header variant on dark background.
 */
export const HeaderVariantDark: Story = {
  args: {
    variant: "header",
    textColor: "#e0e0e0",
  },
  decorators: [
    Story => (
      <div className="rounded-md bg-gray-800 p-4">
        <Story />
      </div>
    ),
  ],
}

/**
 * With a custom class name for sizing.
 */
export const WithCustomClassName: Story = {
  args: {
    className: "w-64",
  },
}

/**
 * Displayed in a header context.
 */
export const InHeaderContext: Story = {
  args: {
    variant: "header",
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="flex items-center justify-between rounded-md bg-indigo-600 px-4 py-2">
        <span className="font-medium text-white">My App</span>
        <Story />
      </div>
    ),
  ],
}

/**
 * Verifies clicking the trigger opens the dropdown.
 */
export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Click the trigger
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Dropdown should appear
    await waitFor(
      async () => {
        const dropdown = await canvas.findByTestId("theme-picker-dropdown")
        await expect(dropdown).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies all themes are displayed in the dropdown.
 */
export const ShowsAllThemes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // All themes should be visible (themes are passed pre-filtered by controller)
    await waitFor(
      async () => {
        await expect(await canvas.findByText("Gruvbox Dark")).toBeVisible()
        await expect(await canvas.findByText("Dracula")).toBeVisible()
        await expect(await canvas.findByText("Solarized Light")).toBeVisible()
        await expect(await canvas.findByText("GitHub Light")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies clicking a theme calls onApplyTheme.
 */
export const SelectingThemeCallsHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Wait for dropdown
    await waitFor(async () => {
      await expect(await canvas.findByTestId("theme-picker-dropdown")).toBeVisible()
    })

    // Click on Dracula theme
    const draculaItem = await canvas.findByTestId("theme-picker-item-dracula")
    await userEvent.click(draculaItem)

    // onApplyTheme should be called with the theme id
    await expect(args.onApplyTheme).toHaveBeenCalledWith("dracula")
  },
}

/**
 * Verifies clicking Refresh calls onRefresh.
 */
export const RefreshCallsHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Wait for dropdown
    await waitFor(async () => {
      await expect(await canvas.findByTestId("theme-picker-dropdown")).toBeVisible()
    })

    // Click Refresh
    const refreshButton = await canvas.findByTestId("theme-picker-refresh")
    await userEvent.click(refreshButton)

    // onRefresh should be called
    await expect(args.onRefresh).toHaveBeenCalled()
  },
}

/**
 * Verifies Escape closes the dropdown.
 */
export const EscapeClosesDropdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Wait for dropdown
    await waitFor(async () => {
      await expect(await canvas.findByTestId("theme-picker-dropdown")).toBeVisible()
    })

    // Press Escape
    await userEvent.keyboard("{Escape}")

    // Dropdown should be closed
    await waitFor(async () => {
      await expect(canvas.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
    })
  },
}

/**
 * Shows checkmark on active theme.
 */
export const ShowsActiveTheme: Story = {
  args: {
    activeThemeId: "dracula",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // The trigger should show "Dracula"
    await expect(await canvas.findByText("Dracula")).toBeVisible()

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Wait for dropdown
    await waitFor(async () => {
      await expect(await canvas.findByTestId("theme-picker-dropdown")).toBeVisible()
    })

    // The Dracula item should have active styling
    const draculaItem = await canvas.findByTestId("theme-picker-item-dracula")
    await expect(draculaItem).toHaveClass("bg-repo-accent/50")
  },
}

/**
 * Shows loading state.
 */
export const Loading: Story = {
  args: {
    isLoading: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Trigger should be disabled
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await expect(trigger).toBeDisabled()
    await expect(trigger).toHaveClass("opacity-70")
  },
}

/**
 * Shows error state.
 */
export const ErrorState: Story = {
  args: {
    error: "Failed to load themes",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Error should be displayed
    await waitFor(
      async () => {
        await expect(await canvas.findByText("Failed to load themes")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Shows empty state when no themes available.
 */
export const EmptyState: Story = {
  args: {
    themes: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Open dropdown
    const trigger = await canvas.findByTestId("theme-picker-trigger")
    await userEvent.click(trigger)

    // Should show empty state
    await waitFor(
      async () => {
        await expect(await canvas.findByText("No themes found")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}
