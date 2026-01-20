import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChatInput } from "./ChatInput"
import { fn } from "storybook/test"

const meta: Meta<typeof ChatInput> = {
  title: "Chat/ChatInput",
  component: ChatInput,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
  args: {
    onSubmit: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "Ask Claude anything...",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Waiting for response...",
  },
}

export const InContainer: Story = {
  render: args => (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="text-muted-foreground mb-2 text-sm">Send a message to the running agent</div>
      <ChatInput {...args} />
    </div>
  ),
}

export const AtBottomOfChat: Story = {
  render: args => (
    <div className="border-border flex h-80 flex-col overflow-hidden rounded-lg border">
      <div className="bg-muted/30 flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="bg-primary/10 text-primary max-w-[80%] rounded-lg p-3">
            Hello! How can I help you today?
          </div>
          <div className="bg-muted ml-auto max-w-[80%] rounded-lg p-3">
            I need help with my project
          </div>
          <div className="bg-primary/10 text-primary max-w-[80%] rounded-lg p-3">
            Of course! What kind of project are you working on?
          </div>
        </div>
      </div>
      <div className="border-border bg-background border-t p-3">
        <ChatInput {...args} />
      </div>
    </div>
  ),
}

export const FullWidth: Story = {
  decorators: [
    Story => (
      <div className="w-full">
        <Story />
      </div>
    ),
  ],
}
