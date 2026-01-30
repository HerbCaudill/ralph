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

## Event mapping

Claude CLI events are near-identical to `ChatEvent`, so the adapter is mostly a pass-through with filtering and timestamp preservation. The adapter normalizes token usage to provide both `snake_case` and `camelCase` keys.

Events with unknown `type` values are silently dropped (the adapter returns `[]`).

<table>
<tr><th>Input (Claude CLI)</th><th>Output (ChatEvent)</th></tr>
<tr>
<td>

```js
// Assistant message
{
  type: "assistant",
  timestamp: 1706000000000,
  message: {
    content: [
      { type: "text", text: "Let me check." },
      {
        type: "tool_use",
        id: "toolu_01X",
        name: "Read",
        input: { file_path: "/src/index.ts" },
      },
    ],
  },
}
```

</td>
<td>

```js
// Passed through as-is
{
  type: "assistant",
  timestamp: 1706000000000,
  message: {
    content: [
      { type: "text", text: "Let me check." },
      {
        type: "tool_use",
        id: "toolu_01X",
        name: "Read",
        input: { file_path: "/src/index.ts" },
      },
    ],
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Tool result
{
  type: "user",
  timestamp: 1706000001000,
  message: {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_01X",
        content: "export function hello()…",
      },
    ],
  },
}
```

</td>
<td>

```js
// Passed through as-is
{
  type: "user",
  timestamp: 1706000001000,
  message: {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_01X",
        content: "export function hello()…",
      },
    ],
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Streaming delta
{
  type: "stream_event",
  timestamp: 1706000002000,
  event: {
    type: "content_block_delta",
    delta: { type: "text_delta", text: "Hello " },
  },
}
```

</td>
<td>

```js
// Passed through as-is
{
  type: "stream_event",
  timestamp: 1706000002000,
  event: {
    type: "content_block_delta",
    delta: { type: "text_delta", text: "Hello " },
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Tool use (structured)
{
  type: "tool_use",
  timestamp: 1706000003000,
  tool: "Bash",
  input: { command: "pnpm test" },
  output: "✓ All tests passed",
  status: "success",
}
```

</td>
<td>

```js
// Passed through as-is
{
  type: "tool_use",
  timestamp: 1706000003000,
  tool: "Bash",
  input: { command: "pnpm test" },
  output: "✓ All tests passed",
  status: "success",
}
```

</td>
</tr>
<tr>
<td>

```js
// Result with token usage
{
  type: "result",
  timestamp: 1706000004000,
  usage: {
    input_tokens: 500,
    output_tokens: 200,
  },
}
```

</td>
<td>

```js
// camelCase aliases added
{
  type: "result",
  timestamp: 1706000004000,
  usage: {
    input_tokens: 500,
    output_tokens: 200,
    inputTokens: 500,
    outputTokens: 200,
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Error
{
  type: "error",
  timestamp: 1706000005000,
  error: "Rate limit exceeded",
}
```

</td>
<td>

```js
// Passed through as-is
{
  type: "error",
  timestamp: 1706000005000,
  error: "Rate limit exceeded",
}
```

</td>
</tr>
</table>

## API

### `createClaudeAdapter()`

Returns an `AgentAdapter` that translates Claude CLI/SDK JSON stream events into agent-view `ChatEvent` objects.

### `convertClaudeEvent(event)`

Converts a single Claude stream event into zero or more `ChatEvent` objects. Returns `[]` for unrecognized event types.
