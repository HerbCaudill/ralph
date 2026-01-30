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

| Event                                                         | Input (Codex SDK)                                                                                                                                                                                       | Output (ChatEvent)                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent message**                                             | `js { type: "item.completed", item: { type: "agent_message", id: "msg-1", text: "Let me run the tests." } } `                                                                                           | `js { type: "assistant", message: { content: [ { type: "text", text: "Let me run the tests." } ] } } `                                                                                       |
| **Reasoning**                                                 | `js { type: "item.completed", item: { type: "reasoning", id: "reasoning-1", text: "I should check the logs." } } `                                                                                      | `js { type: "assistant", message: { content: [ { type: "thinking", thinking: "I should check the logs." } ] } } `                                                                            |
| **Command started**                                           | `js { type: "item.started", item: { type: "command_execution", id: "cmd-1", command: "pnpm test" } } `                                                                                                  | `js { type: "tool_use", id: "cmd-1", tool: "Bash", input: { command: "pnpm test" }, status: "running" } `                                                                                    |
| **Command streaming**                                         | `js { type: "item.updated", item: { type: "command_execution", id: "cmd-1", command: "pnpm test", aggregated_output: "Running tests…" } } `                                                             | `js { type: "tool_use", id: "cmd-1", tool: "Bash", input: { command: "pnpm test" }, output: "Running tests…", status: "running" } `                                                          |
| **Command success**                                           | `js { type: "item.completed", item: { type: "command_execution", id: "cmd-1", command: "pnpm test", aggregated_output: "✓ All 45 tests passed\n", exit_code: 0 } } `                                    | `js { type: "tool_use", id: "cmd-1", tool: "Bash", input: { command: "pnpm test" }, output: "✓ All 45 tests passed\n", status: "success" } `                                                 |
| **Command failure**                                           | `js { type: "item.completed", item: { type: "command_execution", id: "cmd-2", command: "false", exit_code: 1 } } `                                                                                      | `js { type: "tool_use", id: "cmd-2", tool: "Bash", input: { command: "false" }, output: "", status: "error", error: "Command failed with exit code 1" } `                                    |
| **File change**                                               | `js { type: "item.completed", item: { type: "file_change", id: "file-1", changes: [ { kind: "edit", path: "/src/index.ts" } ], status: "completed" } } `                                                | `js { type: "tool_use", id: "file-1", tool: "Edit", input: { changes: [ { kind: "edit", path: "/src/index.ts" } ] }, output: "edit: /src/index.ts", status: "success" } `                    |
| **MCP tool call**                                             | `js { type: "item.completed", item: { type: "mcp_tool_call", id: "mcp-1", server: "test-server", tool: "read_file", arguments: { path: "/foo.ts" }, status: "completed", result: { content: "…" } } } ` | `js { type: "tool_use", id: "mcp-1", tool: "Task", input: { server: "test-server", tool: "read_file", arguments: { path: "/foo.ts" } }, output: "{\"content\":\"…\"}", status: "success" } ` |
| **Turn completed** (cached tokens added to input)             | `js { type: "turn.completed", usage: { input_tokens: 800, cached_input_tokens: 200, output_tokens: 150 } } `                                                                                            | `js { type: "result", usage: { inputTokens: 1000, outputTokens: 150, input_tokens: 1000, output_tokens: 150 } } `                                                                            |
| **Top-level error**                                           | `js { type: "error", message: "API error" } `                                                                                                                                                           | `js { type: "error", error: "API error" } `                                                                                                                                                  |
| **Turn failure**                                              | `js { type: "turn.failed", error: { message: "Context exceeded" } } `                                                                                                                                   | `js { type: "error", error: "Context exceeded" } `                                                                                                                                           |
| **Error item**                                                | `js { type: "item.completed", item: { type: "error", id: "err-1", message: "Something broke" } } `                                                                                                      | `js { type: "error", error: "Something broke" } `                                                                                                                                            |
| **Filtered** (`thread.started`, `turn.started`, unrecognized) | `js { type: "thread.started" } `                                                                                                                                                                        | Dropped (returns `[]`)                                                                                                                                                                       |

## API

### `createCodexAdapter()`

Returns an `AgentAdapter` that translates Codex SDK `ThreadEvent` objects into agent-view `ChatEvent` objects.

### `convertCodexEvent(event)`

Converts a single Codex `ThreadEvent` into zero or more `ChatEvent` objects. Returns `[]` for unrecognized event types.
