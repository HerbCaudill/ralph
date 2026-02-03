import type { Meta, StoryObj } from "@storybook/react-vite"
import { SessionLinks } from ".././SessionLinks"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { useEffect } from "react"

const meta: Meta<typeof SessionLinks> = {
  title: "Collections/SessionLinks",
  component: SessionLinks,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state */
function StoreSetter({ prefix }: { prefix: string }) {
  useEffect(() => {
    beadsViewStore.getState().setIssuePrefix(prefix)
  }, [prefix])
  return null
}

// Note: SessionLinks fetches sessions from IndexedDB using useSessions hook
// In Storybook without populated IndexedDB, it will show loading state

export const Default: Story = {
  render: () => (
    <>
      <StoreSetter prefix="rui" />
      <SessionLinks taskId="rui-4rt" />
    </>
  ),
}

export const WithCustomClassName: Story = {
  render: () => (
    <>
      <StoreSetter prefix="rui" />
      <SessionLinks taskId="rui-4rt" className="bg-muted/20 rounded-lg p-4" />
    </>
  ),
}

// Note: To see the full functionality with session links, you would need to:
// 1. Mock the IndexedDB calls
// 2. Or have sessions stored in IndexedDB
// The component handles loading and empty states gracefully
