import type { Meta, StoryObj } from "@storybook/react-vite"
import { Separator } from "../components/separator"

const meta = {
  title: "Separator",
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 300 }}>
      <div className="space-y-1">
        <h4 className="text-sm leading-none font-medium">Components</h4>
        <p className="text-muted-foreground text-sm">Reusable UI primitives.</p>
      </div>
      <Separator className="my-4" />
      <div className="text-sm">Content below the separator.</div>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <div>Home</div>
      <Separator orientation="vertical" />
      <div>About</div>
      <Separator orientation="vertical" />
      <div>Contact</div>
    </div>
  ),
}
