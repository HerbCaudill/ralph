import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconCircleFilled, IconCircle, IconCircleHalf } from "@tabler/icons-react"
import { ResponsiveButtonGroup } from "../components/responsive-button-group"
import { Button } from "../components/button"

const meta = {
  title: "ResponsiveButtonGroup",
  component: ResponsiveButtonGroup,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ResponsiveButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Wide: Story = {
  render: () => (
    <div style={{ width: 400 }}>
      <ResponsiveButtonGroup>
        <Button variant="outline" size="sm">
          <IconCircleFilled className="h-3.5 w-3.5" />
          <span data-label>Open</span>
        </Button>
        <Button variant="outline" size="sm">
          <IconCircleHalf className="h-3.5 w-3.5" />
          <span data-label>In progress</span>
        </Button>
        <Button variant="outline" size="sm">
          <IconCircle className="h-3.5 w-3.5" />
          <span data-label>Closed</span>
        </Button>
      </ResponsiveButtonGroup>
    </div>
  ),
}

export const Narrow: Story = {
  render: () => (
    <div style={{ width: 150 }}>
      <ResponsiveButtonGroup>
        <Button variant="outline" size="sm">
          <IconCircleFilled className="h-3.5 w-3.5" />
          <span data-label>Open</span>
        </Button>
        <Button variant="outline" size="sm">
          <IconCircleHalf className="h-3.5 w-3.5" />
          <span data-label>In progress</span>
        </Button>
        <Button variant="outline" size="sm">
          <IconCircle className="h-3.5 w-3.5" />
          <span data-label>Closed</span>
        </Button>
      </ResponsiveButtonGroup>
    </div>
  ),
}
