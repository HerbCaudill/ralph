import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconMessageChatbot } from "@tabler/icons-react"
import { EventDisplay } from ".././EventDisplay"
import type { ChatEvent } from "../../types"

const meta: Meta<typeof EventDisplay> = {
  title: "Collections/EventDisplay",
  component: EventDisplay,
  decorators: [
    Story => (
      <div className="border-border h-[500px] overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

const baseTimestamp = Date.now()

const userMessageEvent = (message: string, offset: number = 0): ChatEvent => ({
  type: "user_message",
  timestamp: baseTimestamp - offset,
  message,
})

const assistantTextEvent = (text: string, offset: number = 0): ChatEvent => ({
  type: "assistant",
  timestamp: baseTimestamp - offset,
  message: {
    content: [{ type: "text", text }],
  },
})

export const Empty: Story = {
  args: {
    events: [],
    emptyState: (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
        <IconMessageChatbot className="size-8 opacity-50" />
        <p>No events yet</p>
        <p className="text-xs opacity-70">Events will appear here when activity begins</p>
      </div>
    ),
  },
}

export const SingleMessage: Story = {
  args: {
    events: [userMessageEvent("Hello, can you help me with this task?")],
  },
}

export const Conversation: Story = {
  args: {
    events: [
      userMessageEvent("Can you help me fix the failing tests?", 60000),
      assistantTextEvent("Of course! Let me run the tests first to see what's failing.", 55000),
      {
        type: "assistant",
        timestamp: baseTimestamp - 50000,
        message: {
          content: [
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
        timestamp: baseTimestamp - 45000,
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
      assistantTextEvent("Great news! All tests are passing now.", 40000),
    ],
  },
}

export const WithLoadingIndicator: Story = {
  args: {
    events: [userMessageEvent("What files are in the src directory?", 5000)],
    loadingIndicator: (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
        <span className="text-muted-foreground text-xs">Thinking...</span>
      </div>
    ),
  },
}

export const WithError: Story = {
  args: {
    events: [
      userMessageEvent("Build the project", 30000),
      {
        type: "assistant",
        timestamp: baseTimestamp - 25000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_build",
              name: "Bash",
              input: { command: "pnpm build", description: "Build for production" },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: baseTimestamp - 20000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_build",
              content: "error TS2339: Property 'foo' does not exist on type 'User'.",
              is_error: true,
            },
          ],
        },
      },
      assistantTextEvent("The build failed due to a TypeScript error. Let me investigate.", 15000),
    ],
  },
}

export const LongConversation: Story = {
  args: {
    events: Array.from({ length: 15 }, (_, i) => [
      userMessageEvent(`Question ${i + 1}: How do I implement feature ${i + 1}?`, (15 - i) * 4000),
      assistantTextEvent(
        `To implement feature ${i + 1}, you would need to follow these steps...`,
        (15 - i) * 4000 - 2000,
      ),
    ]).flat(),
  },
}

export const WithCustomEmptyState: Story = {
  args: {
    events: [],
    emptyState: (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Start a conversation</p>
          <p className="text-muted-foreground text-sm">Ask a question to get started</p>
        </div>
      </div>
    ),
  },
}

export const MaxEventsLimited: Story = {
  args: {
    events: Array.from({ length: 50 }, (_, i) =>
      userMessageEvent(`Message ${i + 1}`, (50 - i) * 1000),
    ),
    maxEvents: 10,
  },
}

export const DisabledAutoScroll: Story = {
  args: {
    events: Array.from({ length: 20 }, (_, i) => [
      userMessageEvent(`Question ${i + 1}`, (20 - i) * 3000),
      assistantTextEvent(`Answer ${i + 1}`, (20 - i) * 3000 - 1500),
    ]).flat(),
    autoScrollEnabled: false,
  },
}

export const MultipleToolCalls: Story = {
  args: {
    events: [
      userMessageEvent("Search for files and read the first one", 50000),
      {
        type: "assistant",
        timestamp: baseTimestamp - 45000,
        message: {
          content: [
            { type: "text", text: "I'll search for files and read one." },
            {
              type: "tool_use",
              id: "glob_1",
              name: "Glob",
              input: { pattern: "*.ts" },
            },
            {
              type: "tool_use",
              id: "read_1",
              name: "Read",
              input: { file_path: "src/index.ts" },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: baseTimestamp - 40000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "glob_1",
              content: "src/index.ts\nsrc/app.ts\nsrc/utils.ts",
              is_error: false,
            },
            {
              type: "tool_result",
              tool_use_id: "read_1",
              content: 'export * from ".././app"',
              is_error: false,
            },
          ],
        },
      },
    ],
  },
}
