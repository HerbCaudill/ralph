import type { Meta, StoryObj } from "@storybook/react-vite"
import { ButtonGroup, ButtonGroupSeparator } from "./button-group"
import { Button } from "./button"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconPlayerStop,
  IconBold,
  IconItalic,
  IconUnderline,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
} from "@tabler/icons-react"

const meta: Meta<typeof ButtonGroup> = {
  title: "UI/ButtonGroup",
  component: ButtonGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">One</Button>
      <Button variant="outline">Two</Button>
      <Button variant="outline">Three</Button>
    </ButtonGroup>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="icon">
        <IconBold />
      </Button>
      <Button variant="outline" size="icon">
        <IconItalic />
      </Button>
      <Button variant="outline" size="icon">
        <IconUnderline />
      </Button>
    </ButtonGroup>
  ),
}

export const MediaControls: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerPlayFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerPauseFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerStopFilled className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconPlayerStop className="size-4" />
      </Button>
    </ButtonGroup>
  ),
}

export const WithSeparator: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="ghost" size="icon-sm">
        <IconAlignLeft className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconAlignCenter className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconAlignRight className="size-4" />
      </Button>
      <ButtonGroupSeparator />
      <Button variant="ghost" size="icon-sm">
        <IconBold className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm">
        <IconItalic className="size-4" />
      </Button>
    </ButtonGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  ),
}

export const Mixed: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Cancel</Button>
      <Button variant="default">Save</Button>
    </ButtonGroup>
  ),
}
