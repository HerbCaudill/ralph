import type { Meta, StoryObj } from "@storybook/react-vite"
import { WorkspacePicker } from "./WorkspacePicker"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof WorkspacePicker> = {
  title: "Selectors/WorkspacePicker",
  component: WorkspacePicker,
  parameters: {
    
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state */
function StoreSetter({
  workspace,
  accentColor,
  branch,
}: {
  workspace?: string
  accentColor?: string
  branch?: string
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    if (workspace) store.setWorkspace(workspace)
    if (accentColor) store.setAccentColor(accentColor)
    if (branch) store.setBranch(branch)
  }, [workspace, accentColor, branch])
  return null
}

// Note: WorkspacePicker fetches workspace info from /api/workspace
// In Storybook without a backend, it will show loading/error states

export const Default: Story = {
  render: () => (
    <>
      <StoreSetter workspace="/Users/dev/my-project" accentColor="#3b82f6" branch="main" />
      <WorkspacePicker />
    </>
  ),
}

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
  render: args => (
    <>
      <StoreSetter workspace="/Users/dev/my-project" accentColor="#ffffff" branch="feature/auth" />
      <WorkspacePicker {...args} />
    </>
  ),
}

export const WithAccentColor: Story = {
  render: () => (
    <>
      <StoreSetter workspace="/Users/dev/project-a" accentColor="#22c55e" branch="develop" />
      <WorkspacePicker />
    </>
  ),
}

export const DifferentAccentColors: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Blue accent:</p>
        <StoreSetter workspace="/Users/dev/project-blue" accentColor="#3b82f6" />
        <WorkspacePicker />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Green accent:</p>
        <StoreSetter workspace="/Users/dev/project-green" accentColor="#22c55e" />
        <WorkspacePicker />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Purple accent:</p>
        <StoreSetter workspace="/Users/dev/project-purple" accentColor="#a855f7" />
        <WorkspacePicker />
      </div>
    </div>
  ),
}

export const InHeaderContext: Story = {
  args: {
    variant: "header",
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="flex items-center gap-4 rounded-md bg-slate-800 px-4 py-2">
        <Story />
        <span className="text-muted-foreground text-sm">|</span>
        <span className="text-sm text-white">main</span>
      </div>
    ),
  ],
  render: args => (
    <>
      <StoreSetter workspace="/Users/dev/ralph" accentColor="#f97316" branch="main" />
      <WorkspacePicker {...args} />
    </>
  ),
}

export const NoWorkspace: Story = {
  render: () => (
    <>
      <StoreSetter />
      <WorkspacePicker />
    </>
  ),
}

export const WithCustomClassName: Story = {
  args: {
    className: "w-72",
  },
  render: args => (
    <>
      <StoreSetter workspace="/Users/dev/my-long-project-name" accentColor="#ec4899" />
      <WorkspacePicker {...args} />
    </>
  ),
}
