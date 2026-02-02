import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommentsSection } from ".././CommentsSection"

const meta: Meta<typeof CommentsSection> = {
  title: "Collections/CommentsSection",
  component: CommentsSection,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// Note: CommentsSection fetches comments from /api/tasks/{id}/comments
// In Storybook without a backend, it will show loading state

export const Default: Story = {
  args: {
    taskId: "rui-4rt",
  },
}

export const ReadOnly: Story = {
  args: {
    taskId: "rui-4rt",
    readOnly: true,
  },
}

export const WithCustomClassName: Story = {
  args: {
    taskId: "rui-4rt",
    className: "p-4 border rounded-lg",
  },
}

// Note: To see the full functionality with comments, you would need to:
// 1. Mock the fetch calls
// 2. Or run Storybook with a real backend
// The component handles loading and error states gracefully
