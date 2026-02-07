import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Kbd,
  TooltipButton,
} from "../components/tooltip"
import { Button } from "../components/button"

const meta = {
  title: "Tooltip",
  component: Tooltip,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>This is a tooltip</p>
      </TooltipContent>
    </Tooltip>
  ),
}

export const WithHotkey: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Save</Button>
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center">
          Save file
          <Kbd>Ctrl+S</Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  ),
}

export const TooltipButtonDefault: Story = {
  name: "TooltipButton",
  render: () => (
    <div className="flex gap-2">
      <TooltipButton tooltip="Add item" hotkey="N">
        <Button size="icon" variant="outline">
          <IconPlus />
        </Button>
      </TooltipButton>
      <TooltipButton tooltip="Delete" hotkey="Del">
        <Button size="icon" variant="outline">
          <IconTrash />
        </Button>
      </TooltipButton>
    </div>
  ),
}

export const Sides: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Left</Button>
        </TooltipTrigger>
        <TooltipContent side="left">Left tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Top</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Top tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Bottom</Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Right</Button>
        </TooltipTrigger>
        <TooltipContent side="right">Right tooltip</TooltipContent>
      </Tooltip>
    </div>
  ),
}
