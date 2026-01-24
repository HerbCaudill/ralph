import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskIdLink } from "./TaskIdLink"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof TaskIdLink> = {
  title: "UI/TaskIdLink",
  component: TaskIdLink,
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set the issue prefix in the store */
function IssuePrefixSetter({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  useEffect(() => {
    useAppStore.getState().setIssuePrefix(prefix)
  }, [prefix])
  return <>{children}</>
}

export const SingleTaskId: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "rui-4rt",
  },
}

export const TaskIdInText: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "See task rui-4rt for implementation details.",
  },
}

export const MultipleTaskIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Tasks rui-abc, rui-def, and rui-xyz are all related.",
  },
}

export const SubtaskIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Working on rui-4rt.1 and rui-4rt.2 as part of rui-4rt.",
  },
}

export const NestedSubtasks: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Deep subtask: rui-4rt.1.2.3",
  },
}

export const NoMatchingPrefix: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="proj">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Task rui-4rt won't match because prefix is 'proj'.",
  },
}

export const PlainTextNoIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "This text has no task IDs at all.",
  },
}

export const CustomClassName: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Task rui-4rt with custom styling.",
    className: "text-purple-500 hover:text-purple-700 font-bold",
  },
}

export const InCodeContext: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <code className="bg-muted rounded px-1 py-0.5 text-sm">
          <Story />
        </code>
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "rui-4rt",
  },
}

export const DifferentPrefixes: Story = {
  render: () => (
    <div className="space-y-2">
      <IssuePrefixSetter prefix="rui">
        <p>
          Prefix "rui": <TaskIdLink>rui-abc</TaskIdLink>
        </p>
      </IssuePrefixSetter>
      <IssuePrefixSetter prefix="proj">
        <p>
          Prefix "proj": <TaskIdLink>proj-123</TaskIdLink>
        </p>
      </IssuePrefixSetter>
      <IssuePrefixSetter prefix="task">
        <p>
          Prefix "task": <TaskIdLink>task-xyz</TaskIdLink>
        </p>
      </IssuePrefixSetter>
    </div>
  ),
}
