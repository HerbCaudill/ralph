import type { Meta, StoryObj } from "@storybook/react-vite"
import { TokenUsageDisplay } from "@herbcaudill/agent-view"

const meta: Meta<typeof TokenUsageDisplay> = {
  title: "Indicators/TokenUsageDisplay",
  component: TokenUsageDisplay,
}

export default meta
type Story = StoryObj<typeof meta>

export const SmallUsage: Story = {
  args: { tokenUsage: { input: 1500, output: 500 } },
}

export const MediumUsage: Story = {
  args: { tokenUsage: { input: 45000, output: 12000 } },
}

export const LargeUsage: Story = {
  args: { tokenUsage: { input: 150000, output: 75000 } },
}

export const VeryLargeUsage: Story = {
  args: { tokenUsage: { input: 1500000, output: 500000 } },
}

export const NoUsage: Story = {
  args: { tokenUsage: { input: 0, output: 0 } },
}

export const OnlyInput: Story = {
  args: { tokenUsage: { input: 50000, output: 0 } },
}

export const OnlyOutput: Story = {
  args: { tokenUsage: { input: 0, output: 25000 } },
}

export const InHeaderContext: Story = {
  args: { tokenUsage: { input: 85000, output: 32000 } },
  decorators: [
    Story => (
      <div className="bg-muted flex items-center gap-4 rounded-md px-4 py-2">
        <span className="text-sm font-medium">Running</span>
        <Story />
      </div>
    ),
  ],
}
