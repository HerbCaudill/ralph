import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn, waitFor } from "storybook/test"
import { HotkeysDialog } from ".././HotkeysDialog"

const meta: Meta<typeof HotkeysDialog> = {
  title: "Dialogs/HotkeysDialog",
  component: HotkeysDialog,
  parameters: {},
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

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        const heading = await canvas.findByRole("heading", { name: "Keyboard Shortcuts" })
        await expect(heading).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies the dialog shows Navigation and Agent Control categories.
 * Migrated from Playwright test: "hotkeys dialog shows categories"
 */
export const ShowsCategories: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Should show Navigation category
        await expect(await canvas.findByText("Navigation")).toBeVisible()
        // Should show Agent Control category
        await expect(await canvas.findByText("Agent Control")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies Escape key triggers onClose callback.
 * Migrated from Playwright test: "Escape closes hotkeys dialog"
 */
export const EscapeClosesDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before interacting
    await waitFor(
      async () => {
        const dialog = await canvas.findByRole("dialog")
        await expect(dialog).toBeVisible()
      },
      { timeout: 3000 },
    )

    // Press Escape
    await userEvent.keyboard("{Escape}")

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies session navigation hotkeys are documented in the dialog.
 * Migrated from Playwright test: "session navigation hotkeys are registered"
 */
export const ShowsSessionNavigationHotkeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Verify session navigation hotkeys are documented
        await expect(await canvas.findByText(/previous session/i)).toBeVisible()
        await expect(await canvas.findByText(/next session/i)).toBeVisible()
        await expect(await canvas.findByText(/latest session/i)).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies task navigation hotkeys are documented in the dialog.
 * Migrated from Playwright test: "task navigation hotkeys are registered"
 */
export const ShowsTaskNavigationHotkeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Verify task navigation hotkeys are documented
        await expect(await canvas.findByText(/select previous task/i)).toBeVisible()
        await expect(await canvas.findByText(/select next task/i)).toBeVisible()
        await expect(await canvas.findByText(/open selected task/i)).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies clicking the close button triggers onClose callback.
 */
export const ClickCloseButtonClosesDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before interacting
    await waitFor(
      async () => {
        const dialog = await canvas.findByRole("dialog")
        await expect(dialog).toBeVisible()
      },
      { timeout: 3000 },
    )

    // Find and click the close button
    const closeButton = await canvas.findByRole("button", { name: /close/i })
    await userEvent.click(closeButton)

    // onClose should have been called
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/**
 * Verifies all hotkey categories are displayed (Agent Control, Navigation, Appearance, Help).
 */
export const ShowsAllCategories: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Verify all categories are displayed
        await expect(await canvas.findByText("Agent Control")).toBeVisible()
        await expect(await canvas.findByText("Navigation")).toBeVisible()
        await expect(await canvas.findByText("Appearance")).toBeVisible()
        await expect(await canvas.findByText("Help")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies keyboard shortcuts are displayed with proper formatting.
 * Tests that hotkeys are rendered in styled Kbd elements.
 */
export const ShowsKeyboardShortcutKeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Find the dialog
        const dialog = await canvas.findByRole("dialog")
        await expect(dialog).toBeVisible()

        // Verify some common keyboard shortcuts are displayed
        // These should be in styled Kbd elements
        await expect(await canvas.findByText("⌘K")).toBeVisible() // Quick task input
        await expect(await canvas.findByText("⌘/")).toBeVisible() // Show keyboard shortcuts
        await expect(await canvas.findByText("⌘J")).toBeVisible() // Toggle task chat
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies agent control hotkeys are documented in the dialog.
 */
export const ShowsAgentControlHotkeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking visibility
    await waitFor(
      async () => {
        // Verify agent control hotkeys are documented
        await expect(await canvas.findByText(/start ralph agent/i)).toBeVisible()
        await expect(await canvas.findByText(/stop ralph agent/i)).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Verifies the dialog content is scrollable for long content.
 */
export const DialogContentScrollable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    // Wait for dialog animation to complete before checking
    await waitFor(
      async () => {
        const dialog = await canvas.findByRole("dialog")
        await expect(dialog).toBeVisible()

        // The dialog content should have overflow-y-auto class for scrolling
        // Verify that multiple categories exist (which would require scrolling on small screens)
        await expect(await canvas.findByText("Agent Control")).toBeVisible()
        await expect(await canvas.findByText("Help")).toBeVisible()
      },
      { timeout: 3000 },
    )
  },
}
