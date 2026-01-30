# @herbcaudill/agent-view-claude

Claude SDK adapter for `@herbcaudill/agent-view`. Converts Claude CLI/SDK JSON stream events into the `ChatEvent` format consumed by agent-view components.

## Install

```bash
npm install @herbcaudill/agent-view-claude
```

## Usage

```ts
import { createClaudeAdapter } from "@herbcaudill/agent-view-claude"

const adapter = createClaudeAdapter()

// Convert a single Claude event
const chatEvent = adapter.convertEvent(claudeStreamEvent)

// Convert a batch of events
const chatEvents = adapter.convertEvents(claudeStreamEvents)
```

### With AgentView

```tsx
import { AgentView } from "@herbcaudill/agent-view"
import { createClaudeAdapter } from "@herbcaudill/agent-view-claude"

const adapter = createClaudeAdapter()

function ClaudeSession({ events }) {
  const chatEvents = adapter.convertEvents(events)
  return <AgentView events={chatEvents} isStreaming={true} />
}
```

## API

### `createClaudeAdapter()`

Returns an `AgentAdapter` that translates Claude CLI/SDK JSON stream events into agent-view `ChatEvent` objects.

### `convertClaudeEvent(event)`

Converts a single Claude stream event into a `ChatEvent`. Returns `null` for unrecognized event types.
