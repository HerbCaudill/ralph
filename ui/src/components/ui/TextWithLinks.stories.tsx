import type { Meta, StoryObj } from "@storybook/react-vite"
import { TextWithLinks } from "./TextWithLinks"
import { useAppStore } from "@/store"
import { useEffect } from "react"

const meta: Meta<typeof TextWithLinks> = {
  title: "Content/TextWithLinks",
  component: TextWithLinks,
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

export const PlainText: Story = {
  args: {
    children: "This is plain text without any links.",
  },
}

export const WithTaskId: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "Check out task rui-4rt for more details.",
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
    children:
      "Tasks rui-4rt and rui-abc are related. Also see rui-xyz for the parent implementation.",
  },
}

export const WithSubtaskIds: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: "The subtask rui-4rt.5 is blocking rui-4rt.6 and rui-4rt.7.",
  },
}

export const WithEventLogReference: Story = {
  args: {
    children: "See the event log at #eventlog=abcdef12 for details.",
  },
}

export const MixedContent: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children:
      "Task rui-4rt was completed. Check #eventlog=12345678 for the full output. Related tasks: rui-abc, rui-xyz.",
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
    children: "Task rui-4rt won't be linked because the prefix is 'proj' not 'rui'.",
  },
}

export const InSentenceContext: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children:
      "I've started working on rui-4rt which implements the authentication flow. Once rui-4rt is done, we can proceed with rui-4rt.1 (the unit tests) and rui-4rt.2 (the integration tests).",
  },
}

export const WithSpecialCharacters: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children:
      "Task (rui-4rt) is important! See also: rui-abc, rui-xyz. Note: rui-123 is a separate issue.",
  },
}

export const LongText: Story = {
  decorators: [
    Story => (
      <IssuePrefixSetter prefix="rui">
        <Story />
      </IssuePrefixSetter>
    ),
  ],
  args: {
    children: `This is a longer piece of text that contains multiple task references.

The main epic is rui-epic-1 which contains several tasks:
- rui-4rt: Implement user authentication
- rui-abc: Set up OAuth providers
- rui-xyz: Add session management

Each task has subtasks like rui-4rt.1, rui-4rt.2, etc.

You can view the iteration history at #eventlog=abcd1234 and #eventlog=efgh5678.`,
  },
}
