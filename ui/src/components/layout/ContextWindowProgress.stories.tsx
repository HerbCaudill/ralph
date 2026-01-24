import type { Meta, StoryObj } from "@storybook/react-vite"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof ContextWindowProgress> = {
  title: "Indicators/ContextWindowProgress",
  component: ContextWindowProgress,
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set context window in the store */
function ContextWindowSetter({
  used,
  max,
  children,
}: {
  used: number
  max: number
  children: React.ReactNode
}) {
  useEffect(() => {
    useAppStore.getState().setContextWindow({ used, max })
  }, [used, max])
  return <>{children}</>
}

export const LowUsage: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={10000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const MediumUsage: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={80000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const HighUsage: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={120000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const CriticalUsage: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={180000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const NearlyFull: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={195000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const AtLimit: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={200000} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const NoUsage: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={0} max={200000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const SmallerContextWindow: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={75000} max={100000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const LargerContextWindow: Story = {
  decorators: [
    Story => (
      <ContextWindowSetter used={300000} max={1000000}>
        <Story />
      </ContextWindowSetter>
    ),
  ],
}

export const AllThresholds: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Low (25%):</span>
        <ContextWindowSetter used={50000} max={200000}>
          <ContextWindowProgress />
        </ContextWindowSetter>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Medium (50%):</span>
        <ContextWindowSetter used={100000} max={200000}>
          <ContextWindowProgress />
        </ContextWindowSetter>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">High (75%):</span>
        <ContextWindowSetter used={150000} max={200000}>
          <ContextWindowProgress />
        </ContextWindowSetter>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Critical (90%):</span>
        <ContextWindowSetter used={180000} max={200000}>
          <ContextWindowProgress />
        </ContextWindowSetter>
      </div>
    </div>
  ),
}
