import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { CommandPalette } from ".././CommandPalette"

const mockHandlers = {
  agentStart: fn(),
  agentStop: fn(),
  agentPause: fn(),
  cycleTheme: fn(),
  showHotkeys: fn(),
  focusTaskInput: fn(),
  focusChatInput: fn(),
  toggleTaskChat: fn(),
}

const meta: Meta<typeof CommandPalette> = {
  title: "Dialogs/CommandPalette",
  component: CommandPalette,
  parameters: {},
  args: {
    open: true,
    onClose: fn(),
    handlers: mockHandlers,
    ralphStatus: "stopped",
    isConnected: true,
  },
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state showing the command palette.
 */
export const Default: Story = {}

/**
 * Closed state - command palette is not visible.
 */
export const Closed: Story = {
  args: {
    open: false,
  },
}

/**
 * Shows command palette when Ralph is running (different commands available).
 */
export const WhenRunning: Story = {
  args: {
    ralphStatus: "running",
    isConnected: true,
  },
}

/**
 * Verifies the command palette shows the search input.
 * Migrated from Playwright test: "command palette shows search input"
 */
export const ShowsSearchInput: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command input should be visible (use findByTestId for async waiting)
    const input = await canvas.findByTestId("command-input")
    await expect(input).toBeVisible()
  },
}

/**
 * Verifies clicking the backdrop closes the command palette.
 * Migrated from Playwright test: "clicking backdrop closes command palette"
 */
export const BackdropClosesDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command palette should be visible (use findByTestId for async waiting)
    const palette = await canvas.findByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Click the backdrop
    const backdrop = await canvas.findByTestId("command-backdrop")
    await userEvent.click(backdrop)

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies searching for commands filters the list.
 * Migrated from Playwright test: "can search commands in palette"
 */
export const SearchFiltersCommands: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Get the command input (use findByTestId for async waiting)
    const input = await canvas.findByTestId("command-input")

    // Type to search for theme command
    await userEvent.type(input, "theme")

    // Should show the Toggle Theme command (which has "theme" in keywords)
    await expect(await canvas.findByTestId("command-item-cycleTheme")).toBeVisible()
  },
}

/**
 * Verifies selecting a command calls the handler and closes the palette.
 * Migrated from Playwright test: "selecting a command closes palette"
 */
export const SelectingCommandClosesAndCallsHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command palette should be visible (use findByTestId for async waiting)
    const palette = await canvas.findByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Click the cycle theme command
    const cycleThemeItem = await canvas.findByTestId("command-item-cycleTheme")
    await userEvent.click(cycleThemeItem)

    // Handler should have been called
    await expect(mockHandlers.cycleTheme).toHaveBeenCalled()

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies Escape key closes the command palette.
 */
export const EscapeClosesDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command palette should be visible (use findByTestId for async waiting)
    const palette = await canvas.findByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Press Escape
    await userEvent.keyboard("{Escape}")

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies keyboard navigation with arrow keys.
 * Tests that up/down arrows move between commands.
 */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Get the command input (use findByTestId for async waiting)
    const input = await canvas.findByTestId("command-input")
    await expect(input).toBeVisible()

    // First item is already selected by default in cmdk
    const firstItem = await canvas.findByTestId("command-item-agentStart")
    await expect(firstItem).toHaveAttribute("data-selected", "true")

    // Press down arrow to move to second item
    await userEvent.keyboard("{ArrowDown}")

    // First item should no longer be selected
    await expect(firstItem).toHaveAttribute("data-selected", "false")

    // Second item should now be selected (focusTaskInput - "New task")
    const secondItem = await canvas.findByTestId("command-item-focusTaskInput")
    await expect(secondItem).toHaveAttribute("data-selected", "true")

    // Press up arrow to go back to first item
    await userEvent.keyboard("{ArrowUp}")

    // First item should be selected again
    await expect(firstItem).toHaveAttribute("data-selected", "true")
    await expect(secondItem).toHaveAttribute("data-selected", "false")
  },
}

/**
 * Verifies Enter key executes the currently selected command.
 */
export const EnterKeyExecutesCommand: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Get the command input
    const input = await canvas.findByTestId("command-input")
    await expect(input).toBeVisible()

    // Navigate to cycleTheme command by typing to filter
    await userEvent.type(input, "theme")

    // Press Enter to execute
    await userEvent.keyboard("{Enter}")

    // Handler should have been called
    await expect(mockHandlers.cycleTheme).toHaveBeenCalled()

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies filtering by keywords (e.g., "dark" finds theme command).
 */
export const FilterByKeywords: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Get the command input
    const input = await canvas.findByTestId("command-input")

    // Type a keyword (theme command has "dark" as a keyword)
    await userEvent.type(input, "dark")

    // Theme command should be visible
    await expect(await canvas.findByTestId("command-item-cycleTheme")).toBeVisible()
  },
}

/**
 * Verifies empty state when no commands match search.
 */
export const EmptyStateWhenNoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Get the command input
    const input = await canvas.findByTestId("command-input")

    // Type something that won't match any command
    await userEvent.type(input, "xyznonexistent")

    // Empty state message should be visible
    await expect(await canvas.findByText("No commands found.")).toBeVisible()
  },
}

/**
 * Verifies that when Ralph is running, Stop Ralph is shown instead of Start Ralph.
 */
export const ShowsStopWhenRunning: Story = {
  args: {
    ralphStatus: "running",
    isConnected: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Stop command should be visible
    await expect(await canvas.findByTestId("command-item-agentStop")).toBeVisible()

    // Start command should not be present
    expect(canvas.queryByTestId("command-item-agentStart")).not.toBeInTheDocument()
  },
}

/**
 * Verifies that Pause Ralph changes to Resume Ralph when paused.
 */
export const ShowsResumeWhenPaused: Story = {
  args: {
    ralphStatus: "paused",
    isConnected: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Should show "Resume Ralph" text
    await expect(await canvas.findByText("Resume Ralph")).toBeVisible()
  },
}

/**
 * Verifies that agent commands are hidden when disconnected.
 */
export const HidesAgentCommandsWhenDisconnected: Story = {
  args: {
    ralphStatus: "stopped",
    isConnected: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command palette should be visible
    await expect(await canvas.findByTestId("command-palette")).toBeVisible()

    // Agent commands should not be present when disconnected
    expect(canvas.queryByTestId("command-item-agentStart")).not.toBeInTheDocument()
    expect(canvas.queryByTestId("command-item-agentStop")).not.toBeInTheDocument()

    // Other commands should still be visible (e.g., theme toggle)
    await expect(await canvas.findByTestId("command-item-cycleTheme")).toBeVisible()
  },
}
