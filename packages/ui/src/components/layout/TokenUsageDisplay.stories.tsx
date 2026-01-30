import type { Meta, StoryObj } from "@storybook/react-vite"
import { TokenUsageDisplay } from "./TokenUsageDisplay"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof TokenUsageDisplay> = {
  title: "Indicators/TokenUsageDisplay",
  component: TokenUsageDisplay,
  parameters: {},
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set token usage in the store */
function TokenUsageSetter({
  input,
  output,
  children,
}: {
  input: number
  output: number
  children: React.ReactNode
}) {
  useEffect(() => {
    useAppStore.getState().setTokenUsage({ input, output })
  }, [input, output])
  return <>{children}</>
}

export const SmallUsage: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={1500} output={500}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const MediumUsage: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={45000} output={12000}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const LargeUsage: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={150000} output={75000}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const VeryLargeUsage: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={1500000} output={500000}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const NoUsage: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={0} output={0}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const OnlyInput: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={50000} output={0}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const OnlyOutput: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={0} output={25000}>
        <Story />
      </TokenUsageSetter>
    ),
  ],
}

export const InHeaderContext: Story = {
  decorators: [
    Story => (
      <TokenUsageSetter input={85000} output={32000}>
        <div className="bg-muted flex items-center gap-4 rounded-md px-4 py-2">
          <span className="text-sm font-medium">Running</span>
          <Story />
        </div>
      </TokenUsageSetter>
    ),
  ],
}
