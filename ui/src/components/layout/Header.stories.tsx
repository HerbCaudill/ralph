import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { HeaderView } from "./HeaderView"
import { withStoreState } from "../../../.storybook/decorators"

/**
 * The Header component displays the application logo, workspace picker,
 * and settings controls. It uses the accent color as background with
 * contrasting text.
 *
 * Stories use the HeaderView presentational component directly with args,
 * allowing full control over the displayed state without store mocking.
 */
const meta: Meta<typeof HeaderView> = {
  title: "Layout/Header",
  component: HeaderView,
  args: {
    accentColor: "#007ACC",
    instanceCount: 1,
  },
  argTypes: {
    accentColor: {
      control: "color",
      description: "Accent color for the header background",
    },
    instanceCount: {
      control: { type: "number", min: 1, max: 10 },
      description: "Number of active Ralph instances",
    },
  },
  parameters: {},
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/my-app",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Logo should be visible with "Ralph" text
    await expect(canvas.getByText("Ralph", { exact: true })).toBeInTheDocument()

    // Workspace picker should be visible (shows workspace name or "No workspace")
    await expect(canvas.getByRole("button", { name: /my-app|No workspace/i })).toBeInTheDocument()

    // Settings dropdown trigger should be visible
    await expect(canvas.getByTestId("settings-dropdown-trigger")).toBeInTheDocument()
  },
}

export const WithPeacockColor: Story = {
  args: {
    accentColor: "#42B883",
  },
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/feature-branch",
    }),
  ],
}

export const DefaultAccentColor: Story = {
  args: {
    accentColor: null,
  },
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/my-app",
    }),
  ],
}

export const LongWorkspacePath: Story = {
  args: {
    accentColor: "#9B59B6",
  },
  decorators: [
    withStoreState({
      workspace:
        "/Users/developer/Documents/Projects/enterprise/very-long-project-name-that-might-overflow",
    }),
  ],
}

export const NoWorkspace: Story = {
  args: {
    accentColor: "#FFA500",
  },
  decorators: [
    withStoreState({
      workspace: null,
    }),
  ],
}

export const MultipleInstances: Story = {
  args: {
    accentColor: "#007ACC",
    instanceCount: 3,
  },
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/my-app",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Instance count badge should be visible
    const badge = canvas.getByTestId("instance-count-badge")
    await expect(badge).toBeInTheDocument()
    await expect(badge).toHaveTextContent("3")
  },
}
