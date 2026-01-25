import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { Header } from "./Header"
import { withStoreState } from "../../../.storybook/decorators"

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  parameters: {},
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/my-app",
      accentColor: "#007ACC",
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
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/feature-branch",
      accentColor: "#42B883",
    }),
  ],
}

export const DefaultAccentColor: Story = {
  decorators: [
    withStoreState({
      workspace: "/Users/dev/projects/my-app",
      accentColor: null,
    }),
  ],
}

export const LongWorkspacePath: Story = {
  decorators: [
    withStoreState({
      workspace:
        "/Users/developer/Documents/Projects/enterprise/very-long-project-name-that-might-overflow",
      accentColor: "#9B59B6",
    }),
  ],
}

export const NoWorkspace: Story = {
  decorators: [
    withStoreState({
      workspace: null,
      accentColor: "#FFA500",
    }),
  ],
}
