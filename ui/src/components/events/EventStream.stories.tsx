import type { Meta, StoryObj } from "@storybook/react-vite"
import { EventStream } from "./EventStream"
import { useAppStore } from "@/store"
import { useEffect } from "react"

// Import raw JSONL files
import events1Raw from "../../../.ralph/events-1.jsonl?raw"
import events2Raw from "../../../.ralph/events-2.jsonl?raw"

const meta: Meta<typeof EventStream> = {
  title: "Events/EventStream",
  component: EventStream,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border h-[600px] overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// Parse JSONL and filter to displayable events
function parseJsonl(raw: string, limit = 200): Array<Record<string, unknown>> {
  const lines = raw.trim().split("\n")
  const events: Array<Record<string, unknown>> = []

  for (const line of lines) {
    if (events.length >= limit) break
    try {
      const event = JSON.parse(line)
      // Only include events that EventStream can render
      if (event.type === "assistant" || event.type === "user" || event.type === "user_message") {
        events.push(event)
      }
    } catch {
      // Skip malformed lines
    }
  }

  return events
}

// Parse JSONL including stream events for real-time simulation
// Only includes events from the first session to avoid incomplete streaming
// at session boundaries
function parseJsonlWithStreaming(raw: string): Array<Record<string, unknown>> {
  const lines = raw.trim().split("\n")
  const events: Array<Record<string, unknown>> = []
  let sessionCount = 0

  for (const line of lines) {
    try {
      const event = JSON.parse(line)

      // Track session boundaries - stop after first session
      if (event.type === "system" && event.subtype === "init") {
        sessionCount++
        if (sessionCount > 1) break // Stop at second session
        continue // Skip the init event itself
      }

      // Include stream events, user messages and tool results
      if (event.type === "stream_event" || event.type === "user" || event.type === "user_message") {
        events.push(event)
      }
    } catch {
      // Skip malformed lines
    }
  }

  return events
}

// Parsed events from the JSONL files
const events1 = parseJsonl(events1Raw)
const events2 = parseJsonl(events2Raw)

// Parsed events with streaming for real-time simulation
const events1Streaming = parseJsonlWithStreaming(events1Raw)

// Helper to add events to the store
function EventLoader({
  events,
}: {
  events: Array<{ type: string; timestamp: number; [key: string]: unknown }>
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.clearEvents()
    events.forEach(event => store.addEvent(event))
  }, [events])
  return null
}

// Helper to stream events in real-time
function EventStreamer({
  events,
  intervalMs = 300,
}: {
  events: Array<{ type: string; timestamp: number; [key: string]: unknown }>
  intervalMs?: number
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.clearEvents()

    let index = 0
    const interval = setInterval(() => {
      if (index < events.length) {
        store.addEvent(events[index])
        index++
      } else {
        clearInterval(interval)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }, [events, intervalMs])
  return null
}

// Real events from .ralph/events-1.jsonl - formatted for the new event structure
const realEvents = [
  // User sends a message
  {
    type: "user_message",
    timestamp: Date.now() - 60000,
    message: "Can you help me fix the test failures?",
  },
  // Assistant responds with text and runs a command
  {
    type: "assistant",
    timestamp: Date.now() - 58000,
    message: {
      content: [
        {
          type: "tool_use",
          id: "toolu_01UqFPsNRR3ZkLQBP5F6KUKJ",
          name: "Bash",
          input: {
            command: "pnpm test:all",
            description: "Run all tests to check for errors",
            timeout: 120000,
          },
        },
      ],
    },
  },
  // Tool result
  {
    type: "user",
    timestamp: Date.now() - 55000,
    tool_use_result: "Exit code 1",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01UqFPsNRR3ZkLQBP5F6KUKJ",
          content:
            "Exit code 1\n\nTest Files  2 failed | 23 passed (25)\n      Tests  5 failed | 455 passed (460)\n   Start at  23:28:56\n   Duration  2.02s",
          is_error: true,
        },
      ],
    },
  },
  // Assistant responds with text and reads files
  {
    type: "assistant",
    timestamp: Date.now() - 50000,
    message: {
      content: [
        {
          type: "text",
          text: "I found test failures. Let me examine the failing tests more closely to understand the issues:",
        },
        {
          type: "tool_use",
          id: "toolu_01QbViy1k2VVzsAc2YMugrt5",
          name: "Read",
          input: {
            file_path: "/Users/herbcaudill/ralph-ui/src/components/tasks/TaskSidebar.test.tsx",
          },
        },
        {
          type: "tool_use",
          id: "toolu_01AxR6CtAc7zmLcHBHWqfAEH",
          name: "Read",
          input: {
            file_path: "/Users/herbcaudill/ralph-ui/src/App.test.tsx",
          },
        },
      ],
    },
  },
  // Tool results
  {
    type: "user",
    timestamp: Date.now() - 45000,
    tool_use_result: "File content",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01QbViy1k2VVzsAc2YMugrt5",
          content: `import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskSidebar } from "./TaskSidebar"

describe("TaskSidebar", () => {
  it("renders with tasks heading", () => {
    render(<TaskSidebar />)
    expect(screen.getByRole("heading", { name: /tasks/i })).toBeInTheDocument()
  })
})`,
          is_error: false,
        },
        {
          type: "tool_result",
          tool_use_id: "toolu_01AxR6CtAc7zmLcHBHWqfAEH",
          content: `import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import App from "./App"

describe("App", () => {
  it("renders the main layout", () => {
    render(<App />)
    expect(screen.getByRole("main")).toBeInTheDocument()
  })
})`,
          is_error: false,
        },
      ],
    },
  },
  // Assistant analyzes and makes an edit
  {
    type: "assistant",
    timestamp: Date.now() - 40000,
    message: {
      content: [
        {
          type: "text",
          text: "I see the issue. The tests are looking for a heading that was removed in a recent refactor. Let me fix this:",
        },
        {
          type: "tool_use",
          id: "toolu_01EditFile",
          name: "Edit",
          input: {
            file_path: "/Users/herbcaudill/ralph-ui/src/components/tasks/TaskSidebar.test.tsx",
            old_string: `  it("renders with tasks heading", () => {
    render(<TaskSidebar />)
    expect(screen.getByRole("heading", { name: /tasks/i })).toBeInTheDocument()
  })`,
            new_string: `  it("renders the sidebar", () => {
    render(<TaskSidebar />)
    expect(screen.getByRole("complementary")).toBeInTheDocument()
  })`,
          },
        },
      ],
    },
  },
  // Edit tool result
  {
    type: "user",
    timestamp: Date.now() - 38000,
    tool_use_result: "Edit applied",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01EditFile",
          content: "Edit applied successfully",
          is_error: false,
        },
      ],
    },
  },
  // Assistant updates todos
  {
    type: "assistant",
    timestamp: Date.now() - 35000,
    message: {
      content: [
        {
          type: "tool_use",
          id: "toolu_01TodoWrite",
          name: "TodoWrite",
          input: {
            todos: [
              { content: "Fix TaskSidebar.test.tsx heading assertion", status: "completed" },
              { content: "Fix App.test.tsx layout assertion", status: "in_progress" },
              { content: "Run tests to verify fixes", status: "pending" },
              { content: "Commit changes", status: "pending" },
            ],
          },
        },
      ],
    },
  },
  // Final assistant message
  {
    type: "assistant",
    timestamp: Date.now() - 30000,
    message: {
      content: [
        {
          type: "text",
          text: "I've fixed the first test. Now let me fix the App test and then run all tests to verify the fixes work correctly.",
        },
      ],
    },
  },
]

export const Default: Story = {
  render: args => (
    <>
      <EventLoader events={realEvents} />
      <EventStream {...args} />
    </>
  ),
}

export const Empty: Story = {
  render: args => (
    <>
      <EventLoader events={[]} />
      <EventStream {...args} />
    </>
  ),
}

export const SingleUserMessage: Story = {
  render: args => (
    <>
      <EventLoader
        events={[
          {
            type: "user_message",
            timestamp: Date.now(),
            message: "Hello! Can you help me refactor the authentication module?",
          },
        ]}
      />
      <EventStream {...args} />
    </>
  ),
}

export const ConversationFlow: Story = {
  render: args => (
    <>
      <EventLoader
        events={[
          {
            type: "user_message",
            timestamp: Date.now() - 30000,
            message: "What files handle user authentication?",
          },
          {
            type: "assistant",
            timestamp: Date.now() - 28000,
            message: {
              content: [
                {
                  type: "text",
                  text: "Let me search for authentication-related files in your codebase.",
                },
                {
                  type: "tool_use",
                  id: "toolu_grep",
                  name: "Grep",
                  input: { pattern: "authenticate|auth|login", path: "src" },
                },
              ],
            },
          },
          {
            type: "user",
            timestamp: Date.now() - 25000,
            tool_use_result: "Found files",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_grep",
                  content: "src/auth/login.ts\nsrc/auth/middleware.ts\nsrc/hooks/useAuth.ts",
                  is_error: false,
                },
              ],
            },
          },
          {
            type: "assistant",
            timestamp: Date.now() - 22000,
            message: {
              content: [
                {
                  type: "text",
                  text: "I found three files related to authentication:\n\n- `src/auth/login.ts` - Main login logic\n- `src/auth/middleware.ts` - Auth middleware for API routes\n- `src/hooks/useAuth.ts` - React hook for auth state\n\nWould you like me to examine any of these in detail?",
                },
              ],
            },
          },
          {
            type: "user_message",
            timestamp: Date.now() - 10000,
            message: "Yes, please show me the useAuth hook",
          },
          {
            type: "assistant",
            timestamp: Date.now() - 8000,
            message: {
              content: [
                {
                  type: "tool_use",
                  id: "toolu_read",
                  name: "Read",
                  input: { file_path: "src/hooks/useAuth.ts" },
                },
              ],
            },
          },
        ]}
      />
      <EventStream {...args} />
    </>
  ),
}

export const WithBashOutput: Story = {
  render: args => (
    <>
      <EventLoader
        events={[
          {
            type: "user_message",
            timestamp: Date.now() - 20000,
            message: "Run the tests",
          },
          {
            type: "assistant",
            timestamp: Date.now() - 18000,
            message: {
              content: [
                {
                  type: "tool_use",
                  id: "toolu_bash",
                  name: "Bash",
                  input: { command: "pnpm test", description: "Run unit tests" },
                },
              ],
            },
          },
          {
            type: "user",
            timestamp: Date.now() - 10000,
            tool_use_result: "Test output",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_bash",
                  content: `✓ src/components/Button.test.tsx (5 tests) 42ms
✓ src/components/Input.test.tsx (8 tests) 38ms
✓ src/hooks/useAuth.test.ts (12 tests) 65ms
✓ src/utils/format.test.ts (20 tests) 23ms

Test Files  4 passed (4)
     Tests  45 passed (45)
  Start at  14:32:10
  Duration  1.2s`,
                  is_error: false,
                },
              ],
            },
          },
          {
            type: "assistant",
            timestamp: Date.now() - 5000,
            message: {
              content: [
                {
                  type: "text",
                  text: "All 45 tests passed across 4 test files. The test suite completed in 1.2 seconds.",
                },
              ],
            },
          },
        ]}
      />
      <EventStream {...args} />
    </>
  ),
}

export const WithError: Story = {
  render: args => (
    <>
      <EventLoader
        events={[
          {
            type: "user_message",
            timestamp: Date.now() - 15000,
            message: "Build the project",
          },
          {
            type: "assistant",
            timestamp: Date.now() - 13000,
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
            timestamp: Date.now() - 8000,
            tool_use_result: "Build failed",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_build",
                  content: `error TS2339: Property 'foo' does not exist on type 'User'.

  src/components/UserCard.tsx:15:22
    15   return <div>{user.foo}</div>
                           ~~~

Found 1 error.`,
                  is_error: true,
                },
              ],
            },
          },
          {
            type: "assistant",
            timestamp: Date.now() - 5000,
            message: {
              content: [
                {
                  type: "text",
                  text: "The build failed due to a TypeScript error. The `User` type doesn't have a `foo` property. Let me check the `UserCard` component to fix this.",
                },
              ],
            },
          },
        ]}
      />
      <EventStream {...args} />
    </>
  ),
}

export const TodoUpdates: Story = {
  render: args => (
    <>
      <EventLoader
        events={[
          {
            type: "user_message",
            timestamp: Date.now() - 20000,
            message: "Add dark mode to the app",
          },
          {
            type: "assistant",
            timestamp: Date.now() - 18000,
            message: {
              content: [
                {
                  type: "text",
                  text: "I'll help you add dark mode. Let me create a plan for this implementation.",
                },
                {
                  type: "tool_use",
                  id: "toolu_todo1",
                  name: "TodoWrite",
                  input: {
                    todos: [
                      { content: "Create theme context and provider", status: "pending" },
                      { content: "Add CSS variables for dark theme colors", status: "pending" },
                      { content: "Create theme toggle component", status: "pending" },
                      { content: "Update components to use theme variables", status: "pending" },
                      { content: "Persist theme preference to localStorage", status: "pending" },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: "assistant",
            timestamp: Date.now() - 12000,
            message: {
              content: [
                {
                  type: "text",
                  text: "Starting with the theme context...",
                },
                {
                  type: "tool_use",
                  id: "toolu_todo2",
                  name: "TodoWrite",
                  input: {
                    todos: [
                      { content: "Create theme context and provider", status: "in_progress" },
                      { content: "Add CSS variables for dark theme colors", status: "pending" },
                      { content: "Create theme toggle component", status: "pending" },
                      { content: "Update components to use theme variables", status: "pending" },
                      { content: "Persist theme preference to localStorage", status: "pending" },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: "assistant",
            timestamp: Date.now() - 5000,
            message: {
              content: [
                {
                  type: "tool_use",
                  id: "toolu_todo3",
                  name: "TodoWrite",
                  input: {
                    todos: [
                      { content: "Create theme context and provider", status: "completed" },
                      { content: "Add CSS variables for dark theme colors", status: "completed" },
                      { content: "Create theme toggle component", status: "in_progress" },
                      { content: "Update components to use theme variables", status: "pending" },
                      { content: "Persist theme preference to localStorage", status: "pending" },
                    ],
                  },
                },
              ],
            },
          },
        ]}
      />
      <EventStream {...args} />
    </>
  ),
}

export const LongConversation: Story = {
  render: args => {
    const events = []
    const baseTime = Date.now()

    for (let i = 0; i < 20; i++) {
      events.push({
        type: "user_message",
        timestamp: baseTime - (40 - i * 2) * 1000,
        message: `User question ${i + 1}: How do I implement feature ${i + 1}?`,
      })
      events.push({
        type: "assistant",
        timestamp: baseTime - (39 - i * 2) * 1000,
        message: {
          content: [
            {
              type: "text",
              text: `Here's how to implement feature ${i + 1}. You'll need to create a new component and connect it to the store.`,
            },
          ],
        },
      })
    }

    return (
      <>
        <EventLoader events={events} />
        <EventStream {...args} />
      </>
    )
  },
}

// Stories using real JSONL data from .ralph/ directory

export const RealSession1: Story = {
  name: "Real session: Test fixes",
  render: args => (
    <>
      <EventLoader events={events1 as Array<{ type: string; timestamp: number }>} />
      <EventStream {...args} />
    </>
  ),
}

export const RealSession2: Story = {
  name: "Real session: All tests passing",
  render: args => (
    <>
      <EventLoader events={events2 as Array<{ type: string; timestamp: number }>} />
      <EventStream {...args} />
    </>
  ),
}

export const RealtimeSimulation: Story = {
  name: "Real-time simulation: Test fixes",
  render: args => (
    <>
      <EventStreamer
        events={events1Streaming as Array<{ type: string; timestamp: number }>}
        intervalMs={50}
      />
      <EventStream {...args} />
    </>
  ),
}
