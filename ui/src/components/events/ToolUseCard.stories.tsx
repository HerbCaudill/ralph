import type { Meta, StoryObj } from "@storybook/react-vite"
import { ToolUseCard, type ToolUseEvent, type ToolName } from "./ToolUseCard"

const meta: Meta<typeof ToolUseCard> = {
  title: "Events/ToolUseCard",
  component: ToolUseCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border max-w-2xl overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

const baseEvent: ToolUseEvent = {
  type: "tool_use",
  timestamp: Date.now(),
  tool: "Read",
}

export const ReadPending: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Read",
      status: "pending",
      input: { file_path: "/src/components/Button.tsx" },
    },
  },
}

export const ReadRunning: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Read",
      status: "running",
      input: { file_path: "/src/components/Button.tsx" },
    },
  },
}

export const ReadSuccess: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Read",
      status: "success",
      input: { file_path: "/src/components/Button.tsx" },
      output: `import React from 'react';

export function Button({ children }) {
  return <button className="btn">{children}</button>;
}`,
      duration: 45,
    },
    defaultExpanded: true,
  },
}

export const ReadError: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Read",
      status: "error",
      input: { file_path: "/src/nonexistent.tsx" },
      error: "ENOENT: no such file or directory",
      duration: 12,
    },
    defaultExpanded: true,
  },
}

export const Edit: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Edit",
      status: "success",
      input: {
        file_path: "/src/utils.ts",
        old_string: "const x = 1",
        new_string: "const x = 2",
      },
      output: "Successfully edited file",
      duration: 23,
    },
    defaultExpanded: true,
  },
}

export const Write: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Write",
      status: "success",
      input: {
        file_path: "/src/new-file.ts",
        content: "export const newFeature = true;",
      },
      output: "File created successfully",
      duration: 31,
    },
    defaultExpanded: true,
  },
}

export const Bash: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Bash",
      status: "success",
      input: { command: "npm test" },
      output: `> test
> vitest run

 PASS  src/Button.test.tsx
 PASS  src/utils.test.ts

Test Files: 2 passed
Tests: 15 passed`,
      duration: 3450,
    },
    defaultExpanded: true,
  },
}

export const BashLongRunning: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Bash",
      status: "running",
      input: { command: "npm run build" },
    },
  },
}

export const Grep: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Grep",
      status: "success",
      input: { pattern: "TODO", path: "/src" },
      output: `src/Button.tsx:15: // TODO: Add proper types
src/utils.ts:42: // TODO: Implement caching
src/api.ts:8: // TODO: Handle errors`,
      duration: 156,
    },
    defaultExpanded: true,
  },
}

export const Glob: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Glob",
      status: "success",
      input: { pattern: "src/**/*.test.tsx" },
      output: `src/Button.test.tsx
src/Header.test.tsx
src/Footer.test.tsx
src/utils.test.tsx`,
      duration: 89,
    },
    defaultExpanded: true,
  },
}

export const WebSearch: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "WebSearch",
      status: "success",
      input: { query: "react useEffect cleanup" },
      output: "Found 5 relevant results about React useEffect cleanup patterns...",
      duration: 1234,
    },
    defaultExpanded: true,
  },
}

export const WebFetch: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "WebFetch",
      status: "success",
      input: { url: "https://api.example.com/docs" },
      output: "Fetched documentation page (2.5KB)",
      duration: 890,
    },
    defaultExpanded: true,
  },
}

export const TodoWrite: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "TodoWrite",
      status: "success",
      input: {
        todos: [
          { content: "Fix bug", status: "pending" },
          { content: "Add tests", status: "in_progress" },
        ],
      },
      output: "Updated 2 todos",
      duration: 15,
    },
    defaultExpanded: true,
  },
}

export const Task: Story = {
  args: {
    event: {
      ...baseEvent,
      tool: "Task",
      status: "running",
      input: { description: "Analyze codebase structure" },
    },
  },
}

export const AllTools: Story = {
  render: () => (
    <div className="space-y-0">
      {(
        [
          "Read",
          "Edit",
          "Write",
          "Bash",
          "Grep",
          "Glob",
          "WebSearch",
          "WebFetch",
          "TodoWrite",
          "Task",
        ] as ToolName[]
      ).map((tool, i) => (
        <ToolUseCard
          key={tool}
          event={{
            type: "tool_use",
            timestamp: Date.now() - (10 - i) * 1000,
            tool,
            status: "success",
            input: { example: "data" },
            duration: 100 + i * 50,
          }}
        />
      ))}
    </div>
  ),
  decorators: [
    Story => (
      <div className="border-border max-w-2xl overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}

export const AllStatuses: Story = {
  render: () => (
    <div className="space-y-0">
      <ToolUseCard
        event={{
          type: "tool_use",
          timestamp: Date.now() - 4000,
          tool: "Read",
          status: "pending",
          input: { file_path: "/src/pending.ts" },
        }}
      />
      <ToolUseCard
        event={{
          type: "tool_use",
          timestamp: Date.now() - 3000,
          tool: "Read",
          status: "running",
          input: { file_path: "/src/running.ts" },
        }}
      />
      <ToolUseCard
        event={{
          type: "tool_use",
          timestamp: Date.now() - 2000,
          tool: "Read",
          status: "success",
          input: { file_path: "/src/success.ts" },
          output: "File contents...",
          duration: 45,
        }}
      />
      <ToolUseCard
        event={{
          type: "tool_use",
          timestamp: Date.now() - 1000,
          tool: "Read",
          status: "error",
          input: { file_path: "/src/error.ts" },
          error: "File not found",
          duration: 12,
        }}
      />
    </div>
  ),
  decorators: [
    Story => (
      <div className="border-border max-w-2xl overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}
