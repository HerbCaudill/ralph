import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommentsSection } from "../CommentsSection"
import { mockFetch } from "../../../../.storybook/test-utils"

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
  },
  beforeEach: () => {
    return mockFetch({
      url: "/api/tasks/",
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: sampleComments,
      },
    })
  },
}

export const ReadOnly: Story = {
  args: {
    taskId: "rui-4rt",
    readOnly: true,
  },
  beforeEach: () => {
    return mockFetch({
      url: "/api/tasks/",
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: sampleComments,
      },
    })
  },
}

export const Empty: Story = {
  args: {
    taskId: "rui-empty",
  },
  beforeEach: () => {
    return mockFetch({
      url: "/api/tasks/",
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: [],
      },
    })
  },
}

export const WithCustomClassName: Story = {
  args: {
    taskId: "rui-4rt",
    className: "p-4 border rounded-lg",
  },
  beforeEach: () => {
    return mockFetch({
      url: "/api/tasks/",
      method: "GET",
      status: 200,
      body: {
        ok: true,
        comments: sampleComments,
      },
    })
  },
}
