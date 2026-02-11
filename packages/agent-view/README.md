# @herbcaudill/agent-view

Web UI for coding agents like Claude Code and OpenAI Codex. Displays user and assistant messages, tool use, diffs, errors, and streaming content, with syntax highlighting and VS Code theme support.

## Install

```bash
npm install @herbcaudill/agent-view
```

Peer dependencies: `react` and `react-dom` (^19.2.0).

## Usage

```tsx
import { AgentView } from "@herbcaudill/agent-view"

function App() {
  return <AgentView events={events} isStreaming={true} />
}
```

### With context configuration

```tsx
import { AgentView } from "@herbcaudill/agent-view"
import { useState } from "react"

function App() {
  const [showToolOutput, setShowToolOutput] = useState(true)

  return (
    <AgentView
      events={events}
      isStreaming={false}
      context={{
        isDark: true,
        toolOutput: {
          isVisible: showToolOutput,
          onToggle: () => setShowToolOutput(v => !v),
        },
        workspacePath: "/my/project",
      }}
      header={<h2>Session log</h2>}
      emptyState={<p>No events yet.</p>}
    />
  )
}
```

### Using individual components

```tsx
import {
  EventList,
  EventDisplay,
  ToolUseCard,
  AssistantText,
  UserMessage,
  AgentViewProvider,
} from "@herbcaudill/agent-view"
```

## Components

| Component            | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `AgentView`          | High-level composition with scrollable container, auto-scroll, and slots                           |
| `EventList`          | Headless event list wrapped in `max-w-[100ch]` container (no scroll) - constrains all child events |
| `EventDisplay`       | Event list with scrollable container and empty state                                               |
| `ToolUseCard`        | Collapsible tool use with output preview                                                           |
| `AssistantText`      | Markdown-rendered assistant message                                                                |
| `UserMessage`        | User message display                                                                               |
| `ThinkingBlock`      | Collapsible extended thinking block                                                                |
| `ErrorEvent`         | Error message display                                                                              |
| `DiffView`           | Side-by-side code diff                                                                             |
| `AnsiOutput`         | Terminal output with ANSI color support                                                            |
| `CodeBlock`          | Syntax-highlighted code with Shiki                                                                 |
| `MarkdownContent`    | Markdown renderer with prose styling                                                               |
| `TaskLifecycleEvent` | Task start/complete lifecycle card                                                                 |

## Tool input parsing

Tool use summaries accept tool input as objects or JSON strings. JSON strings are parsed before rendering summaries (for example, Bash commands).
| `PromiseCompleteEvent` | Session complete indicator |
| `SessionPicker` | Popover listing past sessions; shows task ID + title for each session |
| `ChatInput` | Auto-resizing textarea with send button and imperative focus handle |

## Session index

The `SessionIndexEntry` type represents a session in the session picker:

| Field              | Type      | Description                                           |
| ------------------ | --------- | ----------------------------------------------------- |
| `sessionId`        | `string`  | Unique session identifier                             |
| `adapter`          | `string`  | Agent type (e.g., "claude", "codex")                  |
| `firstMessageAt`   | `number`  | Timestamp of first message                            |
| `lastMessageAt`    | `number`  | Timestamp of most recent message                      |
| `firstUserMessage` | `string`  | Preview text from first user message                  |
| `hasResponse`      | `boolean` | Whether the session has received an assistant reply   |
| `isActive`         | `boolean` | Whether a worker is currently running on this session |

### SessionPickerEntry

The `SessionPickerEntry` type extends `SessionIndexEntry` with optional task information:

| Field       | Type                | Description                         |
| ----------- | ------------------- | ----------------------------------- |
| `taskId`    | `string` (optional) | Task ID associated with the session |
| `taskTitle` | `string` (optional) | Task title for display              |

### SessionPicker display

- Each session row shows: task ID (muted) + task title
- Sessions without a task ID display the first user message (or "No task" if missing)
- Active sessions show a spinner icon
- Inactive sessions are indented with a spacer to align task IDs with active sessions

## Utilities

| Function             | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `formatRelativeTime` | Format a timestamp as a relative time string (e.g. "2 hours ago")                             |
| `formatModelName`    | Format a Claude model ID for display (e.g. `"claude-sonnet-4-20250514"` becomes `"Sonnet 4"`) |

## Hooks

| Hook                    | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `useAgentChat`          | WebSocket connection and chat session management                       |
| `useAdapterInfo`        | Fetch adapter info (version, model) from `/api/adapters`               |
| `useAdapterVersion`     | Convenience hook returning just the adapter version string             |
| `useAgentHotkeys`       | Register global keyboard listeners for agent hotkey actions            |
| `useToolExpansionState` | Manage tool expansion state for a session; returns context-ready state |

## Context

Wrap components with `AgentViewProvider` to configure behavior:

```tsx
import { AgentViewProvider } from "@herbcaudill/agent-view"

// ...

return (
  <AgentViewProvider value={{ isDark: true, toolOutput: { isVisible: true, onToggle: () => {} } }}>
    <EventList events={events} />
  </AgentViewProvider>
)
```

### Context options

| Property                | Type                                             | Description                                            |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `isDark`                | `boolean`                                        | Dark mode flag                                         |
| `toolOutput`            | `AgentViewToolOutputControl`                     | Visibility state and toggle callback for tool output   |
| `workspacePath`         | `string \| null`                                 | Base path for relative path display                    |
| `linkHandlers`          | `AgentViewLinkHandlers`                          | Click handlers for task/session links                  |
| `tasks`                 | `AgentViewTask[]`                                | Task list for lifecycle event enrichment               |
| `toolExpansionState`    | `Map<string, boolean>`                           | Session-scoped store for tool expanded/collapsed state |
| `setToolExpansionState` | `(toolUseId: string, expanded: boolean) => void` | Callback to update tool expansion state                |

Tool output visibility is controlled globally via `toolOutput.isVisible`, while each `ToolUseCard` can be toggled independently by clicking its header.

### Persisting tool expansion state

By default, tool cards reset to collapsed when new events stream in (causing re-renders). To persist expansion state across re-renders, use the `useToolExpansionState` hook:

```tsx
import { AgentView, useToolExpansionState } from "@herbcaudill/agent-view"

function MyAgentView({ events, sessionId }) {
  const { toolExpansionState, setToolExpansionState } = useToolExpansionState()

  return <AgentView events={events} context={{ toolExpansionState, setToolExpansionState }} />
}
```

The state persists for the component's lifecycle. When switching sessions, unmount and remount the component to reset the state, or call `clearToolExpansionState()` returned by the hook.

## Agent adapters

The package exports an `AgentAdapter` interface for normalizing events from different agent SDKs:

```tsx
import type { AgentAdapter } from "@herbcaudill/agent-view"
import { createBatchConverter } from "@herbcaudill/agent-view"
```

See `@herbcaudill/agent-view-codex` for a Codex SDK adapter implementation.

## Storybook

```bash
pnpm storybook   # starts on port 6007
```

## Theming

Uses CSS variables from `@herbcaudill/agent-view-theme` for VS Code theme integration. The Storybook includes a theme switcher with Light+, Dark+, Solarized Light, and Solarized Dark themes.
