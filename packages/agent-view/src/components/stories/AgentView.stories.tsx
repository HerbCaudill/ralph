import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AgentView } from ".././AgentView"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import type { ChatEvent } from "../../types"

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

/**
 * Events from session 0d452b73 demonstrating various tool uses:
 * - User asks about lines of code in the repo
 * - Assistant uses Bash to count LOC
 * - User asks for breakdown by file type
 * - Assistant uses multiple Bash commands to analyze by extension
 */
const sessionEvents: ChatEvent[] = [
  {
    type: "user_message",
    timestamp: 1770143528818,
    message: "how many loc in this repo",
  },
  {
    type: "assistant",
    timestamp: 1770143534286,
    message: {
      id: "msg_01HNYAXgA2vhuTuBbXiHusFx",
      content: [
        {
          type: "tool_use",
          id: "toolu_01FXtHDijg5HqpQyiy58hf4u",
          name: "Bash",
          input: {
            command:
              'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./**/dist/*" -not -path "./**/node_modules/*" | xargs wc -l 2>/dev/null | tail -1',
            description: "Count lines of code in TypeScript/JavaScript files",
          },
        },
      ],
    },
  },
  {
    type: "user",
    timestamp: 1770143536000,
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_01FXtHDijg5HqpQyiy58hf4u",
          content: "  59147 total",
          is_error: false,
        },
      ],
    },
  },
  {
    type: "assistant",
    timestamp: 1770143538510,
    message: {
      id: "msg_01RJMt4KfpkhGCJcZvhHXaos",
      content: [
        {
          type: "text",
          text: "**~59,000 lines of code** in this repo (TypeScript/JavaScript files, excluding `node_modules`, `dist`, and `.git`).",
        },
      ],
    },
  },
  {
    type: "user_message",
    timestamp: 1770143642817,
    message: "show me a breakdown by file type",
  },
  {
    type: "assistant",
    timestamp: 1770143648305,
    message: {
      id: "msg_01VkwX4pqAXbp3wBQrMBxs7s",
      content: [
        {
          type: "tool_use",
          id: "toolu_011U1iU2CkoQ7UFLxTL7U8H8",
          name: "Bash",
          input: {
            command:
              'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.css" -o -name "*.html" \\) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./**/dist/*" -not -path "./**/node_modules/*" -not -path "./pnpm-lock.yaml" | while read f; do echo "${f##*.}"; done | sort | uniq -c | sort -rn',
            description: "Count files by extension",
          },
        },
      ],
    },
  },
  {
    type: "user",
    timestamp: 1770143649000,
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_011U1iU2CkoQ7UFLxTL7U8H8",
          content: " 313 ts\n 153 tsx\n  57 md\n  43 json\n  10 js\n   7 css\n   4 html",
          is_error: false,
        },
      ],
    },
  },
  {
    type: "assistant",
    timestamp: 1770143650316,
    message: {
      id: "msg_01VkwX4pqAXbp3wBQrMBxs7s",
      content: [
        {
          type: "tool_use",
          id: "toolu_013VwiRJUcCAx4f4wFXnecmu",
          name: "Bash",
          input: {
            command:
              'for ext in ts tsx js jsx json md css html; do\n  count=$(find . -type f -name "*.$ext" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./**/dist/*" -not -path "./**/node_modules/*" -exec cat {} + 2>/dev/null | wc -l)\n  printf "%6d LOC  .%s\\n" "$count" "$ext"\ndone | sort -rn',
            description: "Count lines of code by file extension",
          },
        },
      ],
    },
  },
  {
    type: "user",
    timestamp: 1770143656000,
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_013VwiRJUcCAx4f4wFXnecmu",
          content:
            " 33320 LOC  .ts\n 24451 LOC  .tsx\n  8240 LOC  .md\n  1837 LOC  .json\n  1289 LOC  .js\n   191 LOC  .css\n   139 LOC  .html",
          is_error: false,
        },
      ],
    },
  },
  {
    type: "assistant",
    timestamp: 1770143659636,
    message: {
      id: "msg_018f2KYhkouYzWuoDZ9kLnXv",
      content: [
        {
          type: "text",
          text: "**Lines of code by file type:**\n\n| Extension | LOC | Files |\n|-----------|----:|------:|\n| `.ts`     | 33,320 | 313 |\n| `.tsx`    | 24,451 | 153 |\n| `.md`     | 8,240 | 57 |\n| `.json`   | 1,837 | 43 |\n| `.js`     | 1,289 | 10 |\n| `.css`    | 191 | 7 |\n| `.html`   | 139 | 4 |\n\n**Total:** ~69,500 LOC across all tracked file types (57,771 in TypeScript/TSX alone).",
        },
      ],
    },
  },
]

/** Wrapper component for stories that need interactive tool output toggle */
function ToolOutputToggleWrapper({
  children,
  defaultVisible,
}: {
  children: React.ReactNode
  defaultVisible: boolean
}) {
  const [isVisible, setIsVisible] = useState(defaultVisible)
  return (
    <AgentViewProvider
      value={{ isDark: false, toolOutput: { isVisible, onToggle: () => setIsVisible(v => !v) } }}
    >
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
        {children}
      </div>
    </AgentViewProvider>
  )
}

/**
 * Shows AgentView with tool output visible (default behavior).
 * Uses real chat output from session 0d452b73 demonstrating LOC analysis.
 * Click the toggle button to interactively switch visibility.
 */
export const ToolOutputVisible: Story = {
  decorators: [
    Story => (
      <ToolOutputToggleWrapper defaultVisible={true}>
        <Story />
      </ToolOutputToggleWrapper>
    ),
  ],
  args: {
    events: sessionEvents,
  },
}

/**
 * Shows AgentView with tool output hidden.
 * Uses real chat output from session 0d452b73 demonstrating LOC analysis.
 * Click the toggle button to interactively switch visibility.
 */
export const ToolOutputHidden: Story = {
  decorators: [
    Story => (
      <ToolOutputToggleWrapper defaultVisible={false}>
        <Story />
      </ToolOutputToggleWrapper>
    ),
  ],
  args: {
    events: sessionEvents,
  },
}
