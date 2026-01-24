import type { Meta, StoryObj } from "@storybook/react-vite"
import { IterationHistoryPanel } from "./IterationHistoryPanel"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof IterationHistoryPanel> = {
  title: "Events/IterationHistoryPanel",
  component: IterationHistoryPanel,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    Story => (
      <div className="border-border h-[600px] w-80 border-r">
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

// Note: The IterationHistoryPanel fetches data from /api/event-logs
// In Storybook, this will show loading/error states unless mocked
// For now, we show the component structure

export const Default: Story = {
  render: () => (
    <>
      <StoreSetter prefix="rui" />
      <IterationHistoryPanel />
    </>
  ),
}

export const WithCustomClassName: Story = {
  args: {
    className: "bg-muted/10",
  },
  render: args => (
    <>
      <StoreSetter prefix="rui" />
      <IterationHistoryPanel {...args} />
    </>
  ),
}

// Note: To see the full functionality with data, you would need to:
// 1. Mock the useEventLogs hook
// 2. Or run Storybook with a real backend
// The component handles loading, error, and empty states gracefully
