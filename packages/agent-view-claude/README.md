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

Claude CLI events are near-identical to `ChatEvent`, so the adapter is mostly a pass-through with filtering and timestamp preservation.

### Assistant message

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "assistant",                        type: "assistant",
  timestamp: 1706000000000,                 timestamp: 1706000000000,
  message: {                                message: {
    content: [                                content: [
      { type: "text",                           { type: "text",
        text: "Let me check." },                  text: "Let me check." },
      { type: "tool_use",                       { type: "tool_use",
        id: "toolu_01X",                          id: "toolu_01X",
        name: "Read",                             name: "Read",
        input: {                                  input: {
          file_path: "/src/index.ts"                file_path: "/src/index.ts"
        }}                                        }}
    ]                                         ]
  }                                         }
}                                         }
```

### Tool result

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "user",                             type: "user",
  timestamp: 1706000001000,                 timestamp: 1706000001000,
  message: {                                message: {
    role: "user",                             role: "user",
    content: [{                               content: [{
      type: "tool_result",                      type: "tool_result",
      tool_use_id: "toolu_01X",                 tool_use_id: "toolu_01X",
      content: "export function hello()…"       content: "export function hello()…"
    }]                                        }]
  }                                         }
}                                         }
```

### Streaming

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "stream_event",                     type: "stream_event",
  timestamp: 1706000002000,                 timestamp: 1706000002000,
  event: {                                  event: {
    type: "content_block_delta",              type: "content_block_delta",
    delta: {                                  delta: {
      type: "text_delta",                       type: "text_delta",
      text: "Hello "                            text: "Hello "
    }                                         }
  }                                         }
}                                         }
```

### Tool use (structured)

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "tool_use",                         type: "tool_use",
  timestamp: 1706000003000,                 timestamp: 1706000003000,
  tool: "Bash",                             tool: "Bash",
  input: { command: "pnpm test" },          input: { command: "pnpm test" },
  output: "✓ All tests passed",             output: "✓ All tests passed",
  status: "success"                         status: "success"
}                                         }
```

### Result with token usage

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "result",                           type: "result",
  timestamp: 1706000004000,                 timestamp: 1706000004000,
  usage: {                                  usage: {
    input_tokens: 500,                        input_tokens: 500,
    output_tokens: 200                        output_tokens: 200,
  }                                           inputTokens: 500,   // added
}                                             outputTokens: 200   // added
                                            }
                                          }
```

The adapter normalizes token usage to provide both `snake_case` and `camelCase` keys.

### Error

```
Input (Claude CLI)                        Output (ChatEvent)
─────────────────                         ──────────────────
{                                    →    {
  type: "error",                            type: "error",
  timestamp: 1706000005000,                 timestamp: 1706000005000,
  error: "Rate limit exceeded"              error: "Rate limit exceeded"
}                                         }
```

### Unrecognized events

Events with unknown `type` values are silently dropped (the adapter returns `[]`).

## API

### `createClaudeAdapter()`

Returns an `AgentAdapter` that translates Claude CLI/SDK JSON stream events into agent-view `ChatEvent` objects.

### `convertClaudeEvent(event)`

Converts a single Claude stream event into zero or more `ChatEvent` objects. Returns `[]` for unrecognized event types.
