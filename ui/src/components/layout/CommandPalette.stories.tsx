import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { CommandPalette } from "./CommandPalette"

const mockHandlers = {
  agentStart: fn(),
  agentStop: fn(),
  agentPause: fn(),
  toggleSidebar: fn(),
  cycleTheme: fn(),
  showHotkeys: fn(),
  focusTaskInput: fn(),
  focusChatInput: fn(),
  toggleTaskChat: fn(),
}

const meta: Meta<typeof CommandPalette> = {
  title: "Layout/CommandPalette",
  component: CommandPalette,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
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

    // Command input should be visible
    const input = canvas.getByTestId("command-input")
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

    // Command palette should be visible
    const palette = canvas.getByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Click the backdrop
    const backdrop = canvas.getByTestId("command-backdrop")
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

    // Get the command input
    const input = canvas.getByTestId("command-input")

    // Type to search for theme command
    await userEvent.type(input, "theme")

    // Should show the Toggle Theme command (which has "theme" in keywords)
    await expect(canvas.getByTestId("command-item-cycleTheme")).toBeVisible()
  },
}

/**
 * Verifies selecting a command calls the handler and closes the palette.
 * Migrated from Playwright test: "selecting a command closes palette"
 */
export const SelectingCommandClosesAndCallsHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Command palette should be visible
    const palette = canvas.getByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Click the toggle sidebar command
    const toggleSidebarItem = canvas.getByTestId("command-item-toggleSidebar")
    await userEvent.click(toggleSidebarItem)

    // Handler should have been called
    await expect(mockHandlers.toggleSidebar).toHaveBeenCalled()

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

    // Command palette should be visible
    const palette = canvas.getByTestId("command-palette")
    await expect(palette).toBeVisible()

    // Press Escape
    await userEvent.keyboard("{Escape}")

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}
