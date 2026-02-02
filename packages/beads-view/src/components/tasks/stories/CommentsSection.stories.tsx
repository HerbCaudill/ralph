import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommentsSection } from "../CommentsSection"
import { mockFetch } from "../../../.storybook/test-utils"
import { useEffect } from "react"

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

const sampleComments = [
  {
    id: "1",
    author: "Alice",
    text: "This looks good to me. Ready to merge?",
    timestamp: Date.now() - 3600000,
  },
  {
    id: "2",
    author: "Bob",
    text: "Let me test it first",
    timestamp: Date.now() - 1800000,
  },
  {
    id: "3",
    author: "Charlie",
    text: "All tests passing ✓",
    timestamp: Date.now() - 900000,
  },
]

/**
 * Story wrapper that mocks the comments API with sample data.
 */
function WithMockedComments({ taskId, ...props }: { taskId: string; readOnly?: boolean; className?: string }) {
  useEffect(() => {
    const cleanup = mockFetch({
      url: `/api/tasks/${taskId}/comments`,
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: sampleComments,
      },
    })
    return cleanup
  }, [taskId])

  return <CommentsSection taskId={taskId} {...props} />
}

/**
 * Story wrapper that mocks empty comments response.
 */
function WithEmptyComments({ taskId, ...props }: { taskId: string; readOnly?: boolean; className?: string }) {
  useEffect(() => {
    const cleanup = mockFetch({
      url: `/api/tasks/${taskId}/comments`,
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: [],
      },
    })
    return cleanup
  }, [taskId])

  return <CommentsSection taskId={taskId} {...props} />
}

export const Default: Story = {
  render: () => <WithMockedComments taskId="rui-4rt" />,
}

export const ReadOnly: Story = {
  render: () => <WithMockedComments taskId="rui-4rt" readOnly />,
}

export const Empty: Story = {
  render: () => <WithEmptyComments taskId="rui-empty" />,
}

export const WithCustomClassName: Story = {
  render: () => <WithMockedComments taskId="rui-4rt" className="p-4 border rounded-lg" />,
}
