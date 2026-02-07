import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconPlus, IconTrash, IconDownload } from "@tabler/icons-react"
import { Button } from "../components/button"

const meta = {
  title: "Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: "Button" },
}

export const Destructive: Story = {
  args: { children: "Delete", variant: "destructive" },
}

export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
}

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
}

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
}

export const Link: Story = {
  args: { children: "Link", variant: "link" },
}

export const Small: Story = {
  args: { children: "Small", size: "sm" },
}

export const Large: Story = {
  args: { children: "Large", size: "lg" },
}

export const ExtraSmall: Story = {
  args: { children: "Tiny", size: "xs" },
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <IconPlus /> Create
      </>
    ),
  },
}

export const IconOnly: Story = {
  args: { children: <IconTrash />, size: "icon", variant: "destructive" },
}

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon-xs">
        <IconDownload />
      </Button>
      <Button size="icon-sm">
        <IconDownload />
      </Button>
      <Button size="icon">
        <IconDownload />
      </Button>
      <Button size="icon-lg">
        <IconDownload />
      </Button>
    </div>
  ),
}
