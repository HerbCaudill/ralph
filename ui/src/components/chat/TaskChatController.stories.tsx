import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskChatController } from "./TaskChatController"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import { fn } from "storybook/test"
import type { ChatEvent, TaskChatMessage } from "@/types"

const meta: Meta<typeof TaskChatController> = {
  title: "Panels/TaskChatController",
  component: TaskChatController,
  parameters: {},
  decorators: [
    Story => (
      <div className="border-border h-[600px] w-96 border-r">
        <Story />
      </div>
    ),
  ],
  args: {
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state for TaskChatController */
function ChatStoreSetter({
  messages,
  events,
  isLoading,
  connectionStatus,
}: {
  messages: TaskChatMessage[]
  events?: ChatEvent[]
  isLoading?: boolean
  connectionStatus?: "connected" | "disconnected" | "connecting"
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.clearTaskChatMessages()
    store.setConnectionStatus(connectionStatus ?? "connected")
    store.setTaskChatLoading(isLoading ?? false)
    messages.forEach(msg => store.addTaskChatMessage(msg))
    if (events) {
      events.forEach(event => store.addTaskChatEvent(event))
    }
  }, [messages, events, isLoading, connectionStatus])
  return null
}

const createUserMessage = (content: string, offset: number = 0): TaskChatMessage => ({
  id: `user-${Date.now() - offset}`,
  role: "user",
  content,
  timestamp: Date.now() - offset,
})

const createAssistantEvent = (text: string, offset: number = 0): ChatEvent => ({
  type: "assistant",
  timestamp: Date.now() - offset,
  message: {
    content: [{ type: "text", text }],
  },
})

export const Empty: Story = {
  render: args => (
    <>
      <ChatStoreSetter messages={[]} />
      <TaskChatController {...args} />
    </>
  ),
}

export const WithMessages: Story = {
  render: args => (
    <>
      <ChatStoreSetter
        messages={[createUserMessage("Can you help me create a new task?", 60000)]}
        events={[
          createAssistantEvent(
            "Of course! I can help you create a new task. What would you like the task to be about?",
            55000,
          ),
        ]}
      />
      <TaskChatController {...args} />
    </>
  ),
}

export const Conversation: Story = {
  render: args => (
    <>
      <ChatStoreSetter
        messages={[
          createUserMessage("Create a task for implementing user authentication", 120000),
          createUserMessage("Make it high priority", 60000),
        ]}
        events={[
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
          createAssistantEvent(
            "Done! I've created task rui-4rt \"Implement user authentication\". I'll update it to high priority.",
            55000,
          ),
        ]}
      />
      <TaskChatController {...args} />
    </>
  ),
}

export const Loading: Story = {
  render: args => (
    <>
      <ChatStoreSetter
        messages={[createUserMessage("What tasks are blocking rui-4rt?", 5000)]}
        isLoading={true}
      />
      <TaskChatController {...args} />
    </>
  ),
}

export const Disconnected: Story = {
  render: args => (
    <>
      <ChatStoreSetter messages={[]} connectionStatus="disconnected" />
      <TaskChatController {...args} />
    </>
  ),
}

export const WithToolUse: Story = {
  render: args => (
    <>
      <ChatStoreSetter
        messages={[createUserMessage("Show me the status of all open tasks", 60000)]}
        events={[
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
        ]}
      />
      <TaskChatController {...args} />
    </>
  ),
}

export const LongConversation: Story = {
  render: args => {
    const messages: TaskChatMessage[] = []
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
      messages.push(createUserMessage(`Tell me about ${topics[i]}`, offset))
      events.push(
        createAssistantEvent(
          `Here's information about ${topics[i]}. This feature allows you to manage your tasks more effectively by providing better organization and tracking capabilities.`,
          offset - 5000,
        ),
      )
    }

    return (
      <>
        <ChatStoreSetter messages={messages} events={events} />
        <TaskChatController {...args} />
      </>
    )
  },
}

export const WithoutCloseButton: Story = {
  args: {
    onClose: undefined,
  },
  render: args => (
    <>
      <ChatStoreSetter
        messages={[createUserMessage("Hello!")]}
        events={[createAssistantEvent("Hello! How can I help you today?")]}
      />
      <TaskChatController {...args} />
    </>
  ),
}

export const WithCustomClassName: Story = {
  args: {
    className: "bg-muted/10",
  },
  render: args => (
    <>
      <ChatStoreSetter messages={[]} />
      <TaskChatController {...args} />
    </>
  ),
}
