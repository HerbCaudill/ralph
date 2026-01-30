import type { Meta, StoryObj } from "@storybook/react-vite"
import { AgentView } from "./AgentView"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import type { ChatEvent } from "@/types"

const meta: Meta<typeof AgentView> = {
  title: "Panels/AgentView",
  component: AgentView,
  parameters: {},
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

/** Helper to set up store state for AgentView */
function AgentStoreSetter({
  events,
  connectionStatus,
  ralphStatus,
}: {
  events: ChatEvent[]
  connectionStatus?: "connected" | "disconnected" | "connecting"
  ralphStatus?: "running" | "stopped" | "paused"
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.clearEvents()
    events.forEach(event => store.addEvent(event))
    store.setConnectionStatus(connectionStatus ?? "connected")
    if (ralphStatus) {
      store.setRalphStatus(ralphStatus)
    }
  }, [events, connectionStatus, ralphStatus])
  return null
}

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
  render: () => (
    <>
      <AgentStoreSetter events={[]} connectionStatus="connected" ralphStatus="running" />
      <AgentView />
    </>
  ),
}

export const WithEvents: Story = {
  render: () => (
    <>
      <AgentStoreSetter
        events={createEvents()}
        connectionStatus="connected"
        ralphStatus="running"
      />
      <AgentView />
    </>
  ),
}

export const Disconnected: Story = {
  render: () => (
    <>
      <AgentStoreSetter
        events={createEvents()}
        connectionStatus="disconnected"
        ralphStatus="stopped"
      />
      <AgentView />
    </>
  ),
}

export const Stopped: Story = {
  render: () => (
    <>
      <AgentStoreSetter
        events={createEvents()}
        connectionStatus="connected"
        ralphStatus="stopped"
      />
      <AgentView />
    </>
  ),
}

export const Paused: Story = {
  render: () => (
    <>
      <AgentStoreSetter events={createEvents()} connectionStatus="connected" ralphStatus="paused" />
      <AgentView />
    </>
  ),
}

export const LongConversation: Story = {
  render: () => {
    const manyEvents: ChatEvent[] = []
    for (let i = 0; i < 15; i++) {
      manyEvents.push({
        type: "user_message",
        timestamp: baseTimestamp - (30 - i * 2) * 1000,
        message: `User message ${i + 1}`,
      })
      manyEvents.push({
        type: "assistant",
        timestamp: baseTimestamp - (29 - i * 2) * 1000,
        message: {
          content: [{ type: "text", text: `Response to message ${i + 1}` }],
        },
      })
    }
    return (
      <>
        <AgentStoreSetter events={manyEvents} connectionStatus="connected" ralphStatus="running" />
        <AgentView />
      </>
    )
  },
}
