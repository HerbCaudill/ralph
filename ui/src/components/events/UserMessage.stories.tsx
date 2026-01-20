import type { Meta, StoryObj } from "@storybook/react-vite"
import { UserMessage } from "./UserMessage"

const meta: Meta<typeof UserMessage> = {
  title: "Events/UserMessage",
  component: UserMessage,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
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
      type: "user_message",
      timestamp: Date.now(),
      message: "Can you help me fix this bug?",
    },
  },
}

export const LongMessage: Story = {
  args: {
    event: {
      type: "user_message",
      timestamp: Date.now(),
      message:
        "I'm having trouble with the authentication flow. When users try to log in, they get redirected to the wrong page. Can you take a look at the login handler and figure out what's going wrong?",
    },
  },
}

export const ShortMessage: Story = {
  args: {
    event: {
      type: "user_message",
      timestamp: Date.now(),
      message: "Yes",
    },
  },
}

export const MultilineMessage: Story = {
  args: {
    event: {
      type: "user_message",
      timestamp: Date.now(),
      message: `Here's what I need:

1. Fix the login bug
2. Add tests
3. Update the documentation

Thanks!`,
    },
  },
}
