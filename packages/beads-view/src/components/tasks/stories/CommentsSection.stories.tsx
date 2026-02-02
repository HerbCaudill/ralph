import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommentsSection } from "../CommentsSection"

const sampleComments = [
  {
    id: 1,
    issue_id: "rui-4rt",
    author: "Alice",
    text: "This looks good to me. Ready to merge?",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    issue_id: "rui-4rt",
    author: "Bob",
    text: "Let me test it first",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 3,
    issue_id: "rui-4rt",
    author: "Charlie",
    text: "All tests passing ✓",
    created_at: new Date(Date.now() - 900000).toISOString(),
  },
]

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

export const Default: Story = {
  args: {
    taskId: "rui-4rt",
    comments: sampleComments,
    onAddComment: async (comment: string) => {
      console.log("Adding comment:", comment)
    },
  },
}

export const ReadOnly: Story = {
  args: {
    taskId: "rui-4rt",
    comments: sampleComments,
    readOnly: true,
  },
}

export const Empty: Story = {
  args: {
    taskId: "rui-empty",
    comments: [],
    onAddComment: async (comment: string) => {
      console.log("Adding comment:", comment)
    },
  },
}

export const Loading: Story = {
  args: {
    taskId: "rui-loading",
    isLoading: true,
  },
}

export const Error: Story = {
  args: {
    taskId: "rui-error",
    error: "Failed to load comments",
  },
}

export const WithCustomClassName: Story = {
  args: {
    taskId: "rui-4rt",
    comments: sampleComments,
    className: "p-4 border rounded-lg",
    onAddComment: async (comment: string) => {
      console.log("Adding comment:", comment)
    },
  },
}
