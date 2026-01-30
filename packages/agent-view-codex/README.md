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

### Agent message → assistant

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "item.completed",                   type: "assistant",
  item: {                                   message: {
    type: "agent_message",                    content: [
    id: "msg-1",                                { type: "text",
    text: "Let me run the tests."                 text: "Let me run the tests." }
  }                                           ]
}                                           }
                                          }
```

### Reasoning → thinking content block

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "item.completed",                   type: "assistant",
  item: {                                   message: {
    type: "reasoning",                        content: [
    id: "reasoning-1",                          { type: "thinking",
    text: "I should check the logs."              thinking: "I should check the logs." }
  }                                           ]
}                                           }
                                          }
```

### Command execution lifecycle

Commands produce events at each stage: started, streaming output, and completed.

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────

Started:
{                                    →    {
  type: "item.started",                     type: "tool_use",
  item: {                                   id: "cmd-1",
    type: "command_execution",              tool: "Bash",
    id: "cmd-1",                            input: { command: "pnpm test" },
    command: "pnpm test"                    status: "running"
  }                                       }
}

Streaming output:
{                                    →    {
  type: "item.updated",                     type: "tool_use",
  item: {                                   id: "cmd-1",
    type: "command_execution",              tool: "Bash",
    id: "cmd-1",                            input: { command: "pnpm test" },
    command: "pnpm test",                   output: "Running tests...\n",
    aggregated_output: "Running tests…"     status: "running"
  }                                       }
}

Completed (success):
{                                    →    {
  type: "item.completed",                   type: "tool_use",
  item: {                                   id: "cmd-1",
    type: "command_execution",              tool: "Bash",
    id: "cmd-1",                            input: { command: "pnpm test" },
    command: "pnpm test",                   output: "✓ All 45 tests passed\n",
    aggregated_output: "✓ All 45…",         status: "success"
    exit_code: 0                          }
  }
}

Completed (failure):
{                                    →    {
  type: "item.completed",                   type: "tool_use",
  item: {                                   id: "cmd-2",
    type: "command_execution",              tool: "Bash",
    id: "cmd-2",                            input: { command: "false" },
    command: "false",                       output: "",
    exit_code: 1                            status: "error",
  }                                         error: "Command failed with exit code 1"
}                                         }
```

### File change → Edit tool use

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "item.completed",                   type: "tool_use",
  item: {                                   id: "file-1",
    type: "file_change",                    tool: "Edit",
    id: "file-1",                           input: {
    changes: [                                changes: [
      { kind: "edit",                           { kind: "edit",
        path: "/src/index.ts" }                   path: "/src/index.ts" }
    ],                                        ]
    status: "completed"                     },
  }                                         output: "edit: /src/index.ts",
}                                           status: "success"
                                          }
```

### MCP tool call → Task tool use

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "item.completed",                   type: "tool_use",
  item: {                                   id: "mcp-1",
    type: "mcp_tool_call",                  tool: "Task",
    id: "mcp-1",                            input: {
    server: "test-server",                    server: "test-server",
    tool: "read_file",                        tool: "read_file",
    arguments: { path: "/foo.ts" },           arguments: { path: "/foo.ts" }
    status: "completed",                    },
    result: { content: "…" }                output: "{\"content\":\"…\"}",
  }                                         status: "success"
}                                         }
```

### Turn completed → result with token usage

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "turn.completed",                   type: "result",
  usage: {                                  usage: {
    input_tokens: 800,                        inputTokens: 1000,   // 800 + 200 cached
    cached_input_tokens: 200,                 outputTokens: 150,
    output_tokens: 150                        input_tokens: 1000,
  }                                           output_tokens: 150
}                                           }
                                          }
```

Cached input tokens are added to input tokens in the output.

### Errors

```
Input (Codex SDK)                         Output (ChatEvent)
─────────────────                         ──────────────────

Top-level error:
{ type: "error",                     →    { type: "error",
  message: "API error" }                    error: "API error" }

Turn failure:
{ type: "turn.failed",              →    { type: "error",
  error: {                                  error: "Context exceeded" }
    message: "Context exceeded" } }

Error item:
{ type: "item.completed",           →    { type: "error",
  item: {                                   error: "Something broke" }
    type: "error",
    id: "err-1",
    message: "Something broke" } }
```

### Filtered events

These Codex events are silently dropped (the adapter returns `[]`):

- `thread.started`
- `turn.started`
- Any event with an unrecognized `type`

## API

### `createCodexAdapter()`

Returns an `AgentAdapter` that translates Codex SDK `ThreadEvent` objects into agent-view `ChatEvent` objects.

### `convertCodexEvent(event)`

Converts a single Codex `ThreadEvent` into zero or more `ChatEvent` objects. Returns `[]` for unrecognized event types.
