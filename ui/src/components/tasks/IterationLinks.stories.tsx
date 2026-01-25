import type { Meta, StoryObj } from "@storybook/react-vite"
import { IterationLinks } from "./IterationLinks"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof IterationLinks> = {
  title: "Collections/IterationLinks",
  component: IterationLinks,
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
    useAppStore.getState().setIssuePrefix(prefix)
  }, [prefix])
  return null
}

// Note: IterationLinks fetches event logs from IndexedDB using useEventLogs hook
// In Storybook without populated IndexedDB, it will show loading state

export const Default: Story = {
  render: () => (
    <>
      <StoreSetter prefix="rui" />
      <IterationLinks taskId="rui-4rt" />
    </>
  ),
}

export const WithCustomClassName: Story = {
  render: () => (
    <>
      <StoreSetter prefix="rui" />
      <IterationLinks taskId="rui-4rt" className="bg-muted/20 rounded-lg p-4" />
    </>
  ),
}

// Note: To see the full functionality with iteration links, you would need to:
// 1. Mock the IndexedDB calls
// 2. Or have event logs stored in IndexedDB
// The component handles loading and empty states gracefully
