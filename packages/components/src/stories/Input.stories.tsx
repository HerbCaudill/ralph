import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "../components/input"
import { Label } from "../components/label"

const meta = {
  title: "Input",
  component: Input,
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: "Type something..." },
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="Email" />
    </div>
  ),
}

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
}

export const File: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="file">Upload file</Label>
      <Input id="file" type="file" />
    </div>
  ),
}

export const WithValue: Story = {
  args: { defaultValue: "hello@example.com", type: "email" },
}
