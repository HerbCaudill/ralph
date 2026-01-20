# Claude Agent Instructions

This is the Ralph UI project - a web interface for the Ralph autonomous AI iteration engine.

## Project Overview

Ralph UI provides a React-based web interface and server for managing autonomous AI agents that can iterate on tasks. The project supports multiple AI agents through an adapter architecture.

## Multi-Agent Support

The project supports multiple coding agents through the `AgentAdapter` abstraction:

### Available Agents

1. **Claude** (default) - Anthropic's Claude via the Claude Agent SDK
   - Uses `@anthropic-ai/claude-agent-sdk`
   - Supports streaming, tools, and system prompts
   - Requires `ANTHROPIC_API_KEY` environment variable

2. **Codex** - OpenAI's Codex via the Codex SDK
   - Uses `@openai/codex-sdk`
   - Supports streaming, tools, and system prompts
   - Requires `OPENAI_API_KEY` environment variable

### Using Different Agents

When Ralph runs in the backend, you can specify which agent to use with the `--agent` flag:

```typescript
// In RalphManager
const manager = new RalphManager({
  agent: "codex", // or "claude" (default)
})
```

The agent selection happens in `server/RalphManager.ts`:

- If `agent` is not "claude" (the default), the `--agent` flag is added to the command
- The flag is passed to the Ralph CLI process

### Agent Adapter Architecture

All agents implement the `AgentAdapter` base class defined in `server/AgentAdapter.ts`:

**Key Components:**

1. **AgentAdapter** - Abstract base class that defines the interface all agents must implement
2. **AdapterRegistry** - Registry for discovering and instantiating adapters
3. **Specific Adapters** - Concrete implementations:
   - `ClaudeAdapter` - Claude Agent SDK implementation
   - `CodexAdapter` - OpenAI Codex SDK implementation

**Event Normalization:**

Each adapter translates native agent events into normalized `AgentEvent` types:

- `AgentMessageEvent` - Text messages from the assistant
- `AgentToolUseEvent` - Tool invocations
- `AgentToolResultEvent` - Tool results
- `AgentResultEvent` - Final result
- `AgentErrorEvent` - Errors
- `AgentStatusEvent` - Status changes

This normalization allows the UI to work with any agent without knowing its specific event format.

## Architecture

### Frontend (React)

- `/src` - React components, hooks, and utilities
- Built with React 19, TypeScript, and Tailwind CSS
- Uses Zustand for state management
- WebSocket connection to the server for real-time updates

### Backend (Node.js)

- `/server` - Express server with WebSocket support
- Agent adapters for multi-agent support
- Event log storage and management
- Task lifecycle tracking via `ralph_task_started` and `ralph_task_completed` events

### Key Files

- `server/AgentAdapter.ts` - Core agent abstraction
- `server/AdapterRegistry.ts` - Agent discovery and factory
- `server/ClaudeAdapter.ts` - Claude SDK implementation
- `server/CodexAdapter.ts` - Codex SDK implementation
- `server/RalphManager.ts` - Ralph CLI process management
- `server/IterationRunner.ts` - Iteration execution using agents

## Event Handling

### Task Lifecycle Events

The Ralph CLI emits structured task lifecycle events that the UI renders as visual blocks:

- `ralph_task_started` - When Claude begins working on a task (e.g., "✨ Starting **r-abc1: Fix bug**")
- `ralph_task_completed` - When Claude completes a task (e.g., "✅ Completed **r-abc1: Fix bug**")

These events are:

1. Emitted by the CLI's `JsonOutput` component when it detects task lifecycle patterns in assistant messages
2. Received by the UI via WebSocket
3. Rendered as `TaskLifecycleEvent` components with special styling

**Deduplication:** To avoid showing both the raw text ("✨ Starting...") and the structured block, the UI:

- Checks if any `ralph_task_started` or `ralph_task_completed` events are present in the event stream
- If so, suppresses rendering of text blocks that match task lifecycle patterns
- Falls back to parsing text blocks for backward compatibility when structured events aren't available

See `src/components/events/EventStream.tsx` for the implementation.

## Development

### Running Tests

```bash
pnpm test          # Run unit tests
pnpm test:pw       # Run Playwright e2e tests
pnpm test:all      # Run all tests (typecheck + unit + e2e)
```

### Building

```bash
pnpm build         # Build both frontend and backend
```

### Development Servers

```bash
pnpm dev           # Start Vite dev server
pnpm dev:server    # Start backend server
```

## Testing Agent Adapters

Each adapter has comprehensive tests:

- `server/AgentAdapter.test.ts` - Base adapter tests
- `server/ClaudeAdapter.test.ts` - Claude adapter tests
- `server/CodexAdapter.test.ts` - Codex adapter tests
- `server/AdapterRegistry.test.ts` - Registry tests

Tests verify:

- Event normalization from native to AgentEvent format
- Start/stop lifecycle
- Message sending
- Error handling
- Availability checking

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Claude agent
- `OPENAI_API_KEY` - Required for Codex agent
- `HOST` - Server host (default: 127.0.0.1)
- `PORT` - Server port (default: 4242)
