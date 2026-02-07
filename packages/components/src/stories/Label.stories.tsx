import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "../components/label"
import { Input } from "../components/input"

const meta = {
  title: "Label",
  component: Label,
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "Email address" },
}

export const WithInput: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="name">Full name</Label>
      <Input id="name" placeholder="Enter your name" />
    </div>
  ),
}
