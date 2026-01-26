# Multi-agent support

## Goal

Allow Ralph to use different CLI coding agents (Claude Code, OpenAI Codex, Aider, etc.) as the underlying engine, making it agent-agnostic.

## Current state

Ralph currently uses the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) directly in `SessionRunner.tsx`. The integration:

- Uses `query()` from the SDK with a `MessageQueue` for streaming input
- Receives `SDKMessage` objects with types like `assistant`, `user`, `result`
- Parses tool calls (Read, Edit, Bash, Grep, etc.) from message content
- Detects completion via `<promise>COMPLETE</promise>` in output

## Approach

Create an **agent adapter abstraction** that normalizes the interface between Ralph and different coding agents.

### Key design decisions

1. **Adapter pattern**: Each agent gets an adapter that implements a common interface
2. **Event normalization**: Different agents emit events in different formats; adapters normalize to a common schema
3. **Configuration-driven**: Agent selection via CLI flag (`--agent claude|codex|aider`) and/or config file
4. **Graceful degradation**: If an agent lacks a feature (e.g., streaming), adapter handles it

### Common event schema

All adapters will emit events conforming to:

```typescript
type AgentEvent =
  | { type: "message"; role: "assistant" | "user"; content: ContentBlock[] }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
  | { type: "tool_result"; id: string; output: string }
  | { type: "result"; text: string }
  | { type: "error"; message: string }

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
```

### Adapter interface

```typescript
interface AgentAdapter {
  name: string

  // Start a session with a prompt
  start(prompt: string): AsyncIterable<AgentEvent>

  // Send a message mid-session (for user interjection)
  send(message: string): void

  // Stop gracefully
  stop(): Promise<void>

  // Check if agent is available
  isAvailable(): Promise<boolean>
}
```

### Supported agents

1. **Claude Code** (via SDK) - current implementation, refactored to adapter
2. **OpenAI Codex** - uses `codex exec --json` with JSONL streaming

## Tasks

1. Define the `AgentAdapter` interface and `AgentEvent` types
2. Create `ClaudeAdapter` by extracting/refactoring current SDK usage
3. Create `CodexAdapter` for OpenAI Codex CLI
4. Create adapter registry and factory function
5. Add `--agent` CLI flag to select adapter
6. Update `SessionRunner` to use adapter interface instead of SDK directly
7. Update event processing (`eventToBlocks.ts`) to handle normalized events
8. Update UI server's `RalphManager` to pass agent configuration
9. Add configuration file support for agent settings
10. Update documentation

## Unresolved questions

1. **Aider integration approach**: Aider doesn't have a native streaming JSON mode. Options:
   - Use [AgentAPI](https://github.com/coder/agentapi) as a wrapper (adds dependency)
   - Parse Aider's terminal output directly (fragile)
   - Skip Aider initially, add later when/if they add JSON mode

2. **Tool compatibility**: Different agents have different built-in tools. How should Ralph handle:
   - Tools that exist in one agent but not another?
   - Different tool names for the same operation?

3. **Prompt compatibility**: The `.ralph/prompt.md` template assumes Claude-specific behaviors. Should we:
   - Have agent-specific templates?
   - Make templates more generic?
   - Both (generic default + agent-specific overrides)?

4. **Completion detection**: Currently uses `<promise>COMPLETE</promise>`. Should each agent have its own completion signal, or enforce a common convention?
