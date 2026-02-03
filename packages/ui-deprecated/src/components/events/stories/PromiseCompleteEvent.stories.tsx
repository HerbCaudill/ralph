import type { Meta, StoryObj } from "@storybook/react-vite"
import { PromiseCompleteEvent } from ".././PromiseCompleteEvent"

const meta: Meta<typeof PromiseCompleteEvent> = {
  title: "Feedback/PromiseCompleteEvent",
  component: PromiseCompleteEvent,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    event: {
      type: "promise_complete",
      timestamp: Date.now(),
    },
  },
}
