# @herbcaudill/agent-view-codex

Codex SDK adapter for `@herbcaudill/agent-view`. Converts Codex thread events into the `ChatEvent` format consumed by agent-view components.

## Install

```bash
npm install @herbcaudill/agent-view-codex
```

## Usage

```ts
import { createCodexAdapter } from "@herbcaudill/agent-view-codex"

const adapter = createCodexAdapter()

// Convert a single Codex event
const chatEvent = adapter.convertEvent(codexThreadEvent)

// Convert a batch of events
const chatEvents = adapter.convertEvents(codexThreadEvents)
```

### With AgentView

```tsx
import { AgentView } from "@herbcaudill/agent-view"
import { createCodexAdapter } from "@herbcaudill/agent-view-codex"

const adapter = createCodexAdapter()

function CodexSession({ events }) {
  const chatEvents = adapter.convertEvents(events)
  return <AgentView events={chatEvents} isStreaming={true} />
}
```

## API

### `createCodexAdapter()`

Returns an `AgentAdapter` that translates Codex SDK `ThreadEvent` objects into agent-view `ChatEvent` objects.

The adapter handles:

- `AgentMessageItem` - Assistant text responses
- `CommandExecutionItem` - Shell command executions
- `ReasoningItem` - Extended thinking blocks
- `McpToolCallItem` - MCP tool calls

### `convertCodexEvent(event)`

Converts a single Codex `ThreadEvent | ThreadItem` into a `ChatEvent`. Returns `null` for unrecognized event types.
