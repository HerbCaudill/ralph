import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { HotkeysDialog } from "./HotkeysDialog"

const meta: Meta<typeof HotkeysDialog> = {
  title: "Layout/HotkeysDialog",
  component: HotkeysDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state showing the keyboard shortcuts dialog.
 */
export const Default: Story = {}

/**
 * Closed state - dialog is not visible.
 */
export const Closed: Story = {
  args: {
    open: false,
  },
}

/**
 * Verifies the dialog shows the expected title and structure.
 */
export const ShowsTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Dialog should be visible with title
    const heading = await canvas.findByRole("heading", { name: "Keyboard Shortcuts" })
    await expect(heading).toBeVisible()
  },
}

/**
 * Verifies the dialog shows Navigation and Agent Control categories.
 * Migrated from Playwright test: "hotkeys dialog shows categories"
 */
export const ShowsCategories: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Should show Navigation category
    await expect(canvas.getByText("Navigation")).toBeVisible()

    // Should show Agent Control category
    await expect(canvas.getByText("Agent Control")).toBeVisible()
  },
}

/**
 * Verifies Escape key triggers onClose callback.
 * Migrated from Playwright test: "Escape closes hotkeys dialog"
 */
export const EscapeClosesDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Dialog should be visible
    const dialog = await canvas.findByRole("dialog")
    await expect(dialog).toBeVisible()

    // Press Escape
    await userEvent.keyboard("{Escape}")

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies iteration navigation hotkeys are documented in the dialog.
 * Migrated from Playwright test: "iteration navigation hotkeys are registered"
 */
export const ShowsIterationNavigationHotkeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Verify iteration navigation hotkeys are documented
    await expect(canvas.getByText(/previous iteration/i)).toBeVisible()
    await expect(canvas.getByText(/next iteration/i)).toBeVisible()
    await expect(canvas.getByText(/latest iteration/i)).toBeVisible()
  },
}

/**
 * Verifies task navigation hotkeys are documented in the dialog.
 * Migrated from Playwright test: "task navigation hotkeys are registered"
 */
export const ShowsTaskNavigationHotkeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Verify task navigation hotkeys are documented
    await expect(canvas.getByText(/select previous task/i)).toBeVisible()
    await expect(canvas.getByText(/select next task/i)).toBeVisible()
    await expect(canvas.getByText(/open selected task/i)).toBeVisible()
  },
}
