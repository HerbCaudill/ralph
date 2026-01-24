import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { TaskIdLink } from "./TaskIdLink"
import { useAppStore } from "@/store"
import { TaskDialogProvider } from "@/contexts"
import { useEffect } from "react"

const meta: Meta<typeof TaskIdLink> = {
  title: "Content/TaskIdLink",
  component: TaskIdLink,
  parameters: {},
  decorators: [
    Story => (
      <TaskDialogProvider openTaskById={fn()}>
        <Story />
      </TaskDialogProvider>
    ),
  ],
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
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "r-4rt",
  },
}

export const TaskIdInText: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "See task r-4rt for implementation details.",
  },
}

export const MultipleTaskIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Tasks r-abc, r-def, and r-xyz are all related.",
  },
}

export const SubtaskIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Working on r-4rt.1 and r-4rt.2 as part of r-4rt.",
  },
}

export const NestedSubtasks: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Deep subtask: r-4rt.1.2.3",
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
    children: "Task r-4rt won't match because prefix is 'proj'.",
  },
}

export const PlainTextNoIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
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
      <IssuePrefixSetter prefix="r">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Task r-4rt with custom styling.",
    className: "text-purple-500 hover:text-purple-700 font-bold",
  },
}

export const InCodeContext: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="r">
        <code className="bg-muted rounded px-1 py-0.5 text-sm">
          <Story />
        </code>
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Task r-4rt is still open",
  },
}

export const DifferentPrefixes: Story = {
  render: () => {
    /** Wrapper that sets prefix and renders children */
    function PrefixExample({ prefix, taskId }: { prefix: string; taskId: string }) {
      useEffect(() => {
        useAppStore.getState().setIssuePrefix(prefix)
      }, [prefix])
      return (
        <p>
          Prefix "{prefix}": <TaskIdLink>{taskId}</TaskIdLink>
        </p>
      )
    }

    return (
      <div className="space-y-2">
        <PrefixExample prefix="r" taskId="r-abc" />
        <PrefixExample prefix="proj" taskId="proj-123" />
        <PrefixExample prefix="task" taskId="task-xyz" />
      </div>
    )
  },
}
