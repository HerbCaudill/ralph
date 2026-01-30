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

## Event mapping

Codex thread events have a different structure from `ChatEvent`, so the adapter performs a non-trivial translation. Codex events don't carry timestamps, so converted events have `timestamp: undefined`.

Events with unknown `type` values are silently dropped (the adapter returns `[]`).

<table>
<tr><th>Input (Codex SDK)</th><th>Output (ChatEvent)</th></tr>
<tr>
<td>

```js
// Agent message
{
  type: "item.completed",
  item: {
    type: "agent_message",
    id: "msg-1",
    text: "Let me run the tests.",
  },
}
```

</td>
<td>

```js
// Mapped to assistant message
{
  type: "assistant",
  message: {
    content: [
      { type: "text", text: "Let me run the tests." },
    ],
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Reasoning
{
  type: "item.completed",
  item: {
    type: "reasoning",
    id: "reasoning-1",
    text: "I should check the logs.",
  },
}
```

</td>
<td>

```js
// Mapped to thinking block
{
  type: "assistant",
  message: {
    content: [
      {
        type: "thinking",
        thinking: "I should check the logs.",
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
// Command started
{
  type: "item.started",
  item: {
    type: "command_execution",
    id: "cmd-1",
    command: "pnpm test",
  },
}
```

</td>
<td>

```js
// Mapped to tool_use (running)
{
  type: "tool_use",
  id: "cmd-1",
  tool: "Bash",
  input: { command: "pnpm test" },
  status: "running",
}
```

</td>
</tr>
<tr>
<td>

```js
// Command streaming
{
  type: "item.updated",
  item: {
    type: "command_execution",
    id: "cmd-1",
    command: "pnpm test",
    aggregated_output: "Running tests…",
  },
}
```

</td>
<td>

```js
// Mapped to tool_use with output
{
  type: "tool_use",
  id: "cmd-1",
  tool: "Bash",
  input: { command: "pnpm test" },
  output: "Running tests…",
  status: "running",
}
```

</td>
</tr>
<tr>
<td>

```js
// Command success
{
  type: "item.completed",
  item: {
    type: "command_execution",
    id: "cmd-1",
    command: "pnpm test",
    aggregated_output: "✓ All 45 tests passed\n",
    exit_code: 0,
  },
}
```

</td>
<td>

```js
// exit_code 0 → success
{
  type: "tool_use",
  id: "cmd-1",
  tool: "Bash",
  input: { command: "pnpm test" },
  output: "✓ All 45 tests passed\n",
  status: "success",
}
```

</td>
</tr>
<tr>
<td>

```js
// Command failure
{
  type: "item.completed",
  item: {
    type: "command_execution",
    id: "cmd-2",
    command: "false",
    exit_code: 1,
  },
}
```

</td>
<td>

```js
// Non-zero exit → error
{
  type: "tool_use",
  id: "cmd-2",
  tool: "Bash",
  input: { command: "false" },
  output: "",
  status: "error",
  error: "Command failed with exit code 1",
}
```

</td>
</tr>
<tr>
<td>

```js
// File change
{
  type: "item.completed",
  item: {
    type: "file_change",
    id: "file-1",
    changes: [
      { kind: "edit", path: "/src/index.ts" },
    ],
    status: "completed",
  },
}
```

</td>
<td>

```js
// Mapped to Edit tool
{
  type: "tool_use",
  id: "file-1",
  tool: "Edit",
  input: {
    changes: [
      { kind: "edit", path: "/src/index.ts" },
    ],
  },
  output: "edit: /src/index.ts",
  status: "success",
}
```

</td>
</tr>
<tr>
<td>

```js
// MCP tool call
{
  type: "item.completed",
  item: {
    type: "mcp_tool_call",
    id: "mcp-1",
    server: "test-server",
    tool: "read_file",
    arguments: { path: "/foo.ts" },
    status: "completed",
    result: { content: "…" },
  },
}
```

</td>
<td>

```js
// Mapped to Task tool
{
  type: "tool_use",
  id: "mcp-1",
  tool: "Task",
  input: {
    server: "test-server",
    tool: "read_file",
    arguments: { path: "/foo.ts" },
  },
  output: "{\"content\":\"…\"}",
  status: "success",
}
```

</td>
</tr>
<tr>
<td>

```js
// Turn completed
// (cached tokens added to input)
{
  type: "turn.completed",
  usage: {
    input_tokens: 800,
    cached_input_tokens: 200,
    output_tokens: 150,
  },
}
```

</td>
<td>

```js
// Token usage normalized
{
  type: "result",
  usage: {
    inputTokens: 1000,
    outputTokens: 150,
    input_tokens: 1000,
    output_tokens: 150,
  },
}
```

</td>
</tr>
<tr>
<td>

```js
// Top-level error
{
  type: "error",
  message: "API error",
}
```

</td>
<td>

```js
// Mapped to error event
{
  type: "error",
  error: "API error",
}
```

</td>
</tr>
<tr>
<td>

```js
// Turn failure
{
  type: "turn.failed",
  error: { message: "Context exceeded" },
}
```

</td>
<td>

```js
// Mapped to error event
{
  type: "error",
  error: "Context exceeded",
}
```

</td>
</tr>
<tr>
<td>

```js
// Error item
{
  type: "item.completed",
  item: {
    type: "error",
    id: "err-1",
    message: "Something broke",
  },
}
```

</td>
<td>

```js
// Mapped to error event
{
  type: "error",
  error: "Something broke",
}
```

</td>
</tr>
<tr>
<td>

```js
// Filtered events
// (thread.started, turn.started, etc.)
{
  type: "thread.started"
}
```

</td>
<td>

```js
// Dropped (returns [])
```

</td>
</tr>
</table>

## API

### `createCodexAdapter()`

Returns an `AgentAdapter` that translates Codex SDK `ThreadEvent` objects into agent-view `ChatEvent` objects.

### `convertCodexEvent(event)`

Converts a single Codex `ThreadEvent` into zero or more `ChatEvent` objects. Returns `[]` for unrecognized event types.
