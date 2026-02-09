import { useState, useCallback } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent } from "storybook/test"
import { AgentView } from ".././AgentView"
import { useAgentHotkeys } from "../../hotkeys/useHotkeys"
import type { ChatEvent } from "../../types"
import {
  sessionLocAnalysisEvents,
  sessionWithToolsEvents,
  sessionWithRalphEvents,
} from "./fixtures/loadEventLog"

const meta: Meta<typeof AgentView> = {
  title: "Panels/AgentView",
  component: AgentView,
  decorators: [
    Story => (
      <div className="h-150 border">
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

/**
 * Events loaded from JSONL fixture (session-loc-analysis.json).
 * Demonstrates various tool uses:
 * - User asks about lines of code in the repo
 * - Assistant uses Bash to count LOC
 * - User asks for breakdown by file type
 * - Assistant uses multiple Bash commands to analyze by extension
 */
const sessionEvents = sessionLocAnalysisEvents

/** Wrapper component for stories that need interactive tool output toggle.
 * Renders AgentView directly with the context prop to avoid nested providers
 * (AgentView creates its own AgentViewProvider, which would override an outer one).
 */
function ToolOutputToggleWrapper({
  events,
  defaultVisible,
}: {
  events: ChatEvent[]
  defaultVisible: boolean
}) {
  const [isVisible, setIsVisible] = useState(defaultVisible)
  const toolOutput = { isVisible, onToggle: () => setIsVisible(v => !v) }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsVisible(v => !v)}
          className="bg-muted text-foreground hover:bg-muted/80 rounded px-3 py-1 text-sm"
        >
          {isVisible ? "Hide" : "Show"} Tool Output
        </button>
        <span className="text-muted-foreground text-xs">
          Tool output is currently {isVisible ? "visible" : "hidden"}
        </span>
      </div>
      <AgentView events={events} context={{ toolOutput }} />
    </div>
  )
}

/**
 * Shows AgentView with tool output visible (default behavior).
 * Uses real chat output from session 0d452b73 demonstrating LOC analysis.
 * Click the toggle button to interactively switch visibility.
 */
export const ToolOutputVisible: Story = {
  render: () => <ToolOutputToggleWrapper events={sessionEvents} defaultVisible={true} />,
}

/**
 * Shows AgentView with tool output hidden.
 * Uses real chat output from session 0d452b73 demonstrating LOC analysis.
 * Click the toggle button to interactively switch visibility.
 */
export const ToolOutputHidden: Story = {
  render: () => <ToolOutputToggleWrapper events={sessionEvents} defaultVisible={false} />,
}

/**
 * Integration test component: wires useAgentHotkeys to tool output state and
 * renders AgentView with the context prop, matching the real pattern used by
 * agent-demo and the UI package.
 */
function AgentViewWithHotkeys({ events }: { events: ChatEvent[] }) {
  const [isVisible, setIsVisible] = useState(true)

  const handleToggleToolOutput = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  useAgentHotkeys({
    handlers: {
      toggleToolOutput: handleToggleToolOutput,
    },
  })

  return (
    <AgentView
      events={events}
      context={{
        isDark: false,
        toolOutput: { isVisible, onToggle: handleToggleToolOutput },
      }}
    />
  )
}

/**
 * Integration test: Ctrl+O toggles tool output visibility.
 * Verifies the full chain: keypress → useAgentHotkeys → state change → context update → DOM change.
 */
export const CtrlOToggle: Story = {
  render: () => <AgentViewWithHotkeys events={sessionEvents} />,
  play: async ({ canvasElement }) => {
    /** Tool output cards have aria-expanded when they have expandable content. */
    const getExpandedCards = () => canvasElement.querySelectorAll<HTMLElement>("[aria-expanded]")

    /** All cards should start expanded (tool output visible by default). */
    const cards = getExpandedCards()
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card).toHaveAttribute("aria-expanded", "true")
    }

    /** Press Ctrl+O — tool output should collapse. */
    await userEvent.keyboard("{Control>}o{/Control}")

    for (const card of getExpandedCards()) {
      expect(card).toHaveAttribute("aria-expanded", "false")
    }

    /** Press Ctrl+O again — tool output should expand. */
    await userEvent.keyboard("{Control>}o{/Control}")

    for (const card of getExpandedCards()) {
      expect(card).toHaveAttribute("aria-expanded", "true")
    }
  },
}

/**
 * Uses real event data from a test run session (session-with-tools.json).
 * Shows a complete session with system init, tool use, and results.
 */
export const RealSessionWithTools: Story = {
  args: {
    events: sessionWithToolsEvents,
  },
}

/**
 * Uses real event data from a Ralph agent session (session-with-ralph-events.json).
 * Demonstrates Ralph-specific events like ralph_task_started, ralph_task_completed,
 * and ralph_session_start/end events used for task tracking.
 */
export const RalphSession: Story = {
  args: {
    events: sessionWithRalphEvents,
  },
}
