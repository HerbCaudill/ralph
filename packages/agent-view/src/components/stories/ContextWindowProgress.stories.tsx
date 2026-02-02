import type { Meta, StoryObj } from "@storybook/react-vite"
import { ContextWindowProgress } from ".././ContextWindowProgress"

const meta: Meta<typeof ContextWindowProgress> = {
  title: "Indicators/ContextWindowProgress",
  component: ContextWindowProgress,
}

export default meta
type Story = StoryObj<typeof meta>

export const LowUsage: Story = {
  args: { contextWindow: { used: 10000, max: 200000 } },
}

export const MediumUsage: Story = {
  args: { contextWindow: { used: 80000, max: 200000 } },
}

export const HighUsage: Story = {
  args: { contextWindow: { used: 120000, max: 200000 } },
}

export const CriticalUsage: Story = {
  args: { contextWindow: { used: 180000, max: 200000 } },
}

export const NearlyFull: Story = {
  args: { contextWindow: { used: 195000, max: 200000 } },
}

export const AtLimit: Story = {
  args: { contextWindow: { used: 200000, max: 200000 } },
}

export const NoUsage: Story = {
  args: { contextWindow: { used: 0, max: 200000 } },
}

export const SmallerContextWindow: Story = {
  args: { contextWindow: { used: 75000, max: 100000 } },
}

export const LargerContextWindow: Story = {
  args: { contextWindow: { used: 300000, max: 1000000 } },
}

export const AllThresholds: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Low (25%):</span>
        <ContextWindowProgress contextWindow={{ used: 50000, max: 200000 }} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Medium (50%):</span>
        <ContextWindowProgress contextWindow={{ used: 100000, max: 200000 }} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">High (75%):</span>
        <ContextWindowProgress contextWindow={{ used: 150000, max: 200000 }} />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground w-20 text-sm">Critical (90%):</span>
        <ContextWindowProgress contextWindow={{ used: 180000, max: 200000 }} />
      </div>
    </div>
  ),
}
