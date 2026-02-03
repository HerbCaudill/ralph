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

function App() {
  return (
    <AgentView
      events={events}
      isStreaming={false}
      context={{
        isDark: true,
        toolOutput: { showOutput: true },
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

| Component              | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `AgentView`            | High-level composition with scrollable container, auto-scroll, and slots |
| `EventList`            | Headless event list (no container/scroll)                                |
| `EventDisplay`         | Event list with scrollable container and empty state                     |
| `ToolUseCard`          | Collapsible tool use with output preview                                 |
| `AssistantText`        | Markdown-rendered assistant message                                      |
| `UserMessage`          | User message display                                                     |
| `ThinkingBlock`        | Collapsible extended thinking block                                      |
| `ErrorEvent`           | Error message display                                                    |
| `DiffView`             | Side-by-side code diff                                                   |
| `AnsiOutput`           | Terminal output with ANSI color support                                  |
| `CodeBlock`            | Syntax-highlighted code with Shiki                                       |
| `MarkdownContent`      | Markdown renderer with prose styling                                     |
| `TaskLifecycleEvent`   | Task start/complete lifecycle card                                       |
| `PromiseCompleteEvent` | Session complete indicator                                               |
| `SessionPicker`        | Popover listing past sessions with relative timestamps                   |
| `ChatInput`            | Auto-resizing textarea with send button and imperative focus handle      |

## Utilities

| Function             | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `formatRelativeTime` | Format a timestamp as a relative time string (e.g. "2 hours ago") |

## Context

Wrap components with `AgentViewProvider` to configure behavior:

```tsx
import { AgentViewProvider } from "@herbcaudill/agent-view"

// ...

return (
  <AgentViewProvider value={{ isDark: true, toolOutput: { showOutput: true } }}>
    <EventList events={events} />
  </AgentViewProvider>
)
```

### Context options

| Property        | Type                      | Description                              |
| --------------- | ------------------------- | ---------------------------------------- |
| `isDark`        | `boolean`                 | Dark mode flag                           |
| `toolOutput`    | `{ showOutput: boolean }` | Whether to show tool output content      |
| `workspacePath` | `string \| null`          | Base path for relative path display      |
| `linkHandlers`  | `AgentViewLinkHandlers`   | Click handlers for task/session links    |
| `tasks`         | `AgentViewTask[]`         | Task list for lifecycle event enrichment |

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
