import type { Meta, StoryObj } from "@storybook/react-vite"
import { EventList } from "./EventList"
import type { ChatEvent } from "../types"

const meta: Meta<typeof EventList> = {
  title: "Collections/EventList",
  component: EventList,
  decorators: [
    Story => (
      <div className="border-border h-[500px] overflow-y-auto rounded-md border">
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

const toolUseEvent = (
  name: string,
  input: Record<string, unknown>,
  offset: number = 0,
): ChatEvent => ({
  type: "assistant",
  timestamp: baseTimestamp - offset,
  message: {
    content: [
      {
        type: "tool_use",
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        input,
      },
    ],
  },
})

export const Empty: Story = {
  args: {
    events: [],
  },
}

export const SingleUserMessage: Story = {
  args: {
    events: [userMessageEvent("Hello, can you help me with this task?")],
  },
}

export const SingleAssistantMessage: Story = {
  args: {
    events: [
      assistantTextEvent(
        "Of course! I'd be happy to help you with your task. What would you like me to do?",
      ),
    ],
  },
}

export const Conversation: Story = {
  args: {
    events: [
      userMessageEvent("Can you read the package.json file?", 30000),
      assistantTextEvent("Let me read the package.json file for you.", 28000),
      toolUseEvent("Read", { file_path: "/project/package.json" }, 27000),
      {
        type: "user",
        timestamp: baseTimestamp - 25000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_read_1",
              content: '{\n  "name": "my-project",\n  "version": "1.0.0"\n}',
              is_error: false,
            },
          ],
        },
      },
      assistantTextEvent(
        'The package.json shows this is a project called "my-project" at version 1.0.0.',
        23000,
      ),
    ],
  },
}

export const WithToolUse: Story = {
  args: {
    events: [
      userMessageEvent("Run the tests", 20000),
      toolUseEvent("Bash", { command: "npm test", description: "Run test suite" }, 18000),
      {
        type: "user",
        timestamp: baseTimestamp - 15000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_bash_1",
              content: "✓ All 45 tests passed (4 test files)",
              is_error: false,
            },
          ],
        },
      },
      assistantTextEvent("All 45 tests passed successfully!", 13000),
    ],
  },
}

export const WithError: Story = {
  args: {
    events: [
      userMessageEvent("Build the project", 15000),
      toolUseEvent(
        "Bash",
        { command: "npm run build", description: "Build for production" },
        13000,
      ),
      {
        type: "user",
        timestamp: baseTimestamp - 10000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_bash_2",
              content:
                "error TS2339: Property 'foo' does not exist on type 'User'.\nBuild failed with 1 error.",
              is_error: true,
            },
          ],
        },
      },
      assistantTextEvent(
        "The build failed due to a TypeScript error. Let me investigate and fix it.",
        8000,
      ),
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

export const LongConversation: Story = {
  args: {
    events: Array.from({ length: 10 }, (_, i) => [
      userMessageEvent(`Question ${i + 1}: How do I implement feature ${i + 1}?`, (10 - i) * 6000),
      assistantTextEvent(
        `To implement feature ${i + 1}, you would need to follow these steps. First, create the component. Then, add the business logic. Finally, write tests to verify the implementation.`,
        (10 - i) * 6000 - 3000,
      ),
    ]).flat(),
  },
}

export const MaxEventsLimit: Story = {
  args: {
    events: Array.from({ length: 50 }, (_, i) =>
      userMessageEvent(`Message ${i + 1}`, (50 - i) * 1000),
    ),
    maxEvents: 10,
  },
}
