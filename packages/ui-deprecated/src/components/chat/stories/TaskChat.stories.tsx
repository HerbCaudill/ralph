import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskChat } from ".././TaskChat"
import { fn } from "storybook/test"
import type { ChatEvent } from "@/types"

const meta: Meta<typeof TaskChat> = {
  title: "Panels/TaskChat",
  component: TaskChat,
  parameters: {},
  decorators: [
    Story => (
      <div className="border-border h-[600px] w-96 border-r">
        <Story />
      </div>
    ),
  ],
  args: {
    events: [],
    isLoading: false,
    isDisabled: false,
    error: null,
    placeholder: "How can I help?",
    storageKey: "storybook-task-chat-draft",
    loadingJustCompleted: false,
    onSendMessage: fn(),
    onClearHistory: fn(),
    onClose: fn(),
    onLoadingComplete: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

const createUserEvent = (content: string, offset: number = 0): ChatEvent => ({
  type: "user_message",
  timestamp: Date.now() - offset,
  message: content,
})

const createAssistantEvent = (text: string, offset: number = 0): ChatEvent => ({
  type: "assistant",
  timestamp: Date.now() - offset,
  message: {
    content: [{ type: "text", text }],
  },
})

export const Empty: Story = {}

export const WithMessages: Story = {
  args: {
    events: [
      createUserEvent("Can you help me create a new task?", 60000),
      createAssistantEvent(
        "Of course! I can help you create a new task. What would you like the task to be about?",
        55000,
      ),
    ],
  },
}

export const Conversation: Story = {
  args: {
    events: [
      createUserEvent("Create a task for implementing user authentication", 120000),
      createAssistantEvent(
        "I'll create a task for implementing user authentication. Let me do that now...",
        110000,
      ),
      {
        type: "assistant",
        timestamp: Date.now() - 100000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "Bash",
              input: {
                command: 'bd create --title="Implement user authentication" --type=feature',
              },
            },
          ],
        },
      },
      createUserEvent("Make it high priority", 60000),
      createAssistantEvent(
        "Done! I've created task rui-4rt \"Implement user authentication\". I'll update it to high priority.",
        55000,
      ),
    ],
  },
}

export const Loading: Story = {
  args: {
    events: [createUserEvent("What tasks are blocking rui-4rt?", 5000)],
    isLoading: true,
    isDisabled: true,
    placeholder: "Waiting for response...",
  },
}

export const Disconnected: Story = {
  args: {
    isDisabled: true,
    placeholder: "Connecting...",
  },
}

export const WithToolUse: Story = {
  args: {
    events: [
      createUserEvent("Show me the status of all open tasks", 60000),
      createAssistantEvent("Let me check the status of open tasks.", 55000),
      {
        type: "assistant",
        timestamp: Date.now() - 50000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool_bd_list",
              name: "Bash",
              input: { command: "bd list --status=open" },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: Date.now() - 45000,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool_bd_list",
              content:
                "rui-1 | open | Implement authentication\nrui-2 | open | Add dark mode\nrui-3 | open | Fix navigation bug",
              is_error: false,
            },
          ],
        },
      },
      createAssistantEvent(
        "Here are the open tasks:\n\n- **rui-1**: Implement authentication\n- **rui-2**: Add dark mode\n- **rui-3**: Fix navigation bug",
        40000,
      ),
    ],
  },
}

export const LongConversation: Story = {
  args: {
    events: (() => {
      const events: ChatEvent[] = []
      const topics = [
        "task dependencies",
        "priority levels",
        "blocking issues",
        "task assignment",
        "status updates",
      ]

      for (let i = 0; i < 5; i++) {
        const offset = (5 - i) * 30000
        events.push(createUserEvent(`Tell me about ${topics[i]}`, offset))
        events.push(
          createAssistantEvent(
            `Here's information about ${topics[i]}. This feature allows you to manage your tasks more effectively by providing better organization and tracking capabilities.`,
            offset - 5000,
          ),
        )
      }

      return events
    })(),
  },
}

export const WithoutCloseButton: Story = {
  args: {
    events: [createUserEvent("Hello!"), createAssistantEvent("Hello! How can I help you today?")],
    onClose: undefined,
  },
}

export const WithError: Story = {
  args: {
    events: [createUserEvent("Hello!")],
    error: "Failed to send message. Please try again.",
  },
}

export const WithCustomClassName: Story = {
  args: {
    className: "bg-muted/10",
  },
}
