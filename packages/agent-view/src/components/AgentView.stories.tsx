import type { Meta, StoryObj } from "@storybook/react-vite"
import { AgentView } from "./AgentView"
import type { ChatEvent } from "../types"

const meta: Meta<typeof AgentView> = {
  title: "Panels/AgentView",
  component: AgentView,
  decorators: [
    Story => (
      <div className="h-[600px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

const baseTimestamp = Date.now()

const createEvents = (): ChatEvent[] => [
  {
    type: "user_message",
    timestamp: baseTimestamp - 60000,
    message: "Can you help me fix the failing tests?",
  },
  {
    type: "assistant",
    timestamp: baseTimestamp - 55000,
    message: {
      content: [
        {
          type: "text",
          text: "I'll run the tests first to see what's failing.",
        },
        {
          type: "tool_use",
          id: "toolu_test",
          name: "Bash",
          input: { command: "pnpm test", description: "Run test suite" },
        },
      ],
    },
  },
  {
    type: "user",
    timestamp: baseTimestamp - 50000,
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_test",
          content: "✓ All 45 tests passed",
          is_error: false,
        },
      ],
    },
  },
  {
    type: "assistant",
    timestamp: baseTimestamp - 45000,
    message: {
      content: [
        {
          type: "text",
          text: "All tests are passing now. The issue seems to have been resolved.",
        },
      ],
    },
  },
]

export const Empty: Story = {
  args: {
    events: [],
  },
}

export const WithEvents: Story = {
  args: {
    events: createEvents(),
  },
}

export const Streaming: Story = {
  args: {
    events: createEvents(),
    isStreaming: true,
  },
}

export const WithEmptyState: Story = {
  args: {
    events: [],
    emptyState: (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center text-sm">
          <p className="text-lg font-medium">No events yet</p>
          <p>Events will appear here when activity begins</p>
        </div>
      </div>
    ),
  },
}

export const WithHeader: Story = {
  args: {
    events: createEvents(),
    header: <div className="border-border border-b p-3 text-sm font-medium">Session #1</div>,
  },
}

export const WithFooter: Story = {
  args: {
    events: createEvents(),
    footer: (
      <div className="border-border border-t p-3 text-xs text-muted-foreground">
        4 events · Last updated just now
      </div>
    ),
  },
}

export const LongConversation: Story = {
  args: {
    events: Array.from({ length: 15 }, (_, i) => [
      {
        type: "user_message",
        timestamp: baseTimestamp - (30 - i * 2) * 1000,
        message: `User message ${i + 1}`,
      } as ChatEvent,
      {
        type: "assistant",
        timestamp: baseTimestamp - (29 - i * 2) * 1000,
        message: {
          content: [{ type: "text", text: `Response to message ${i + 1}` }],
        },
      } as ChatEvent,
    ]).flat(),
  },
}
