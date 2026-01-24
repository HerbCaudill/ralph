import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThemePicker } from "./ThemePicker"

const meta: Meta<typeof ThemePicker> = {
  title: "Layout/ThemePicker",
  component: ThemePicker,
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Note: ThemePicker fetches themes from /api/themes
// In Storybook without a backend, it will show the dropdown structure
// but won't have actual theme data

export const Default: Story = {
  args: {},
}

export const HeaderVariant: Story = {
  args: {
    variant: "header",
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="rounded-md bg-blue-600 p-4">
        <Story />
      </div>
    ),
  ],
}

export const HeaderVariantDark: Story = {
  args: {
    variant: "header",
    textColor: "#e0e0e0",
  },
  decorators: [
    Story => (
      <div className="rounded-md bg-gray-800 p-4">
        <Story />
      </div>
    ),
  ],
}

export const WithCustomClassName: Story = {
  args: {
    className: "w-64",
  },
}

export const InHeaderContext: Story = {
  args: {
    variant: "header",
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="flex items-center justify-between rounded-md bg-indigo-600 px-4 py-2">
        <span className="font-medium text-white">My App</span>
        <Story />
      </div>
    ),
  ],
}

export const MultipleVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Default variant:</p>
        <ThemePicker />
      </div>
      <div className="rounded-md bg-purple-600 p-4">
        <p className="mb-2 text-sm text-white">Header variant:</p>
        <ThemePicker variant="header" textColor="#ffffff" />
      </div>
    </div>
  ),
}
