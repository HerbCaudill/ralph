import type { Meta, StoryObj } from "@storybook/react-vite"
import { Textarea } from "../components/textarea"
import { Label } from "../components/label"

const meta = {
  title: "Textarea",
  component: Textarea,
  decorators: [
    Story => (
      <div className="w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: "Type your message here..." },
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-1.5">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Type your message here..." />
    </div>
  ),
}

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
}

export const WithValue: Story = {
  args: {
    defaultValue:
      "This is a textarea with some pre-filled content that demonstrates how the component handles longer text.",
  },
}
