import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChatInput } from ".././ChatInput"
import { fn } from "storybook/test"

const meta: Meta<typeof ChatInput> = {
  title: "Inputs/ChatInput",
  component: ChatInput,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-lg rounded-lg border p-2">
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

export const MultiLine: Story = {
  render: args => {
    const Component = () => {
      // Pre-fill with multi-line text after mount
      const handleRef = () => {
        setTimeout(() => {
          const textarea = document.querySelector("textarea")
          if (textarea) {
            const multiLineText = `This is a message that spans multiple lines.

It demonstrates that the submit button should be positioned in the lower right corner, not vertically centered.

The button stays at the bottom as the textarea grows.`
            // Trigger React's onChange by setting value and dispatching input event
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              "value",
            )?.set
            nativeInputValueSetter?.call(textarea, multiLineText)
            textarea.dispatchEvent(new Event("input", { bubbles: true }))
          }
        }, 100)
      }

      return (
        <div ref={handleRef}>
          <ChatInput {...args} />
        </div>
      )
    }
    return <Component />
  },
}

export const AtBottomOfChat: Story = {
  render: args => (
    <div className="flex h-80 flex-col overflow-hidden">
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
      <div className="bg-background p-3">
        <ChatInput {...args} />
      </div>
    </div>
  ),
}
