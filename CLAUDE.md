# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Custom Beads Hooks

This project has custom hooks in `.beads/hooks/`:

- **on_close** - Auto-closes parent epics when all children are closed

Note: Beads internal hooks (`on_close`, `on_create`, `on_update`) aren't automatically
called yet in beads v0.47.x. Until that feature is implemented, you can manually run
the hook after closing: `.beads/hooks/on_close <issue-id>`

Or use the wrapper: `.beads/hooks/bd-close <issue-id> [--reason="..."]`

## User Input During Runtime

Ralph supports sending user messages to Claude while it's working:

- **Escape** - Opens a text input to send a message to Claude (only while running; press again to cancel)
- **Ctrl+T** - Opens a text input to add a todo item (only if todo.md exists)
- **Ctrl+S** - Stop gracefully after the current session completes
- **Ctrl+P** - Pause/resume: pause after current session completes, press again to resume

User-injected messages appear in the output stream with a 📨 prefix and green color, so users know their message was received and processed.

### Stdin Commands (JSON Mode)

When running in JSON mode (`ralph --json`), commands can be sent via stdin as JSON:

- `{"type": "message", "text": "..."}` - Send a message to Claude
- `{"type": "stop"}` - Stop gracefully after current session
- `{"type": "pause"}` - Pause after current session completes
- `{"type": "resume"}` - Resume from paused state

### Implementation Details

The feature uses the Claude Agent SDK's streaming input mode. Instead of passing a string prompt to `query()`, we pass a `MessageQueue` (an async iterable) that:

1. Yields the initial prompt message
2. Can receive additional messages pushed via `push()` from the UI
3. Uses promises to block session until new messages arrive

When a user sends a message via Escape:

1. The message is pushed to the MessageQueue for the SDK
2. A display event is added to the events state for visual feedback
3. The `eventToBlocks.ts` parser handles `user` type events and creates `user` content blocks
4. The `formatContentBlock.ts` formats user blocks with a distinctive style

See `src/lib/MessageQueue.ts` for the queue implementation.

## Debug Logging

Ralph has built-in debug logging to help diagnose issues like hangs. Enable it with the `RALPH_DEBUG` environment variable:

```bash
# Enable all debug logging
RALPH_DEBUG=1 ralph

# Enable specific namespace
RALPH_DEBUG=messagequeue ralph    # MessageQueue push/next/close operations
RALPH_DEBUG=session ralph       # Session lifecycle events

# Enable multiple namespaces
RALPH_DEBUG=messagequeue,session ralph
```

Debug logs are written to stderr with timestamps, so they don't interfere with the normal output.

---

## Project Overview

Ralph is an autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt and todo list, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple sessions.

## Key Architecture

### Core Flow

1. **CLI Entry** (`cli.ts`) → Defines Commander.js program with modes:
   - Main mode: Run N sessions (`ralph [sessions]`)
   - Watch mode: Watch for new beads issues after completion (`ralph --watch`)
   - Agent selection: Select AI agent to use (`ralph --agent <name>`, defaults to `claude`)
   - Init mode: Set up `.ralph/` directory (`ralph init`)
   - Replay mode: Replay events from log (`ralph --replay [file]`)

2. **Session Runner** (`SessionRunner.tsx`) → Core orchestration:
   - Combines core-prompt.md with .ralph/workflow.md (or bundled default)
   - Spawns `claude` CLI with `--output-format stream-json`
   - Parses streaming JSON events line-by-line
   - Appends events to `.ralph/events-*.jsonl`
   - Detects `<promise>COMPLETE</promise>` to exit early (or enter watch mode if `--watch`)
   - Recursively runs next session after completion
   - In watch mode: polls beads daemon for new issues via Unix socket RPC

3. **Event Processing** (`eventToBlocks.ts`) → Transforms raw JSON events into display blocks:
   - Extracts tool calls (Read, Edit, Bash, Grep, Glob, TodoWrite, etc.)
   - Shortens file paths to relative paths
   - Formats tool arguments for display
   - Creates unique IDs for React keys

4. **Display Layer** (`EventDisplay.tsx`, `ToolUse.tsx`) → Renders events using Ink components

### Template System

Ralph uses a two-tier prompt system:

1. **Core prompt** (`cli/templates/core-prompt.md`) - Bundled session protocol (required by Ralph)
   - Session lifecycle (check errors → find issue → work → complete)
   - Task assignment logic
   - Output tokens (`<promise>COMPLETE</promise>`, `<start_task>`, `<end_task>`)

2. **Workflow** (`.ralph/workflow.md`) - Repo-specific configuration
   - Build/test commands
   - Task prioritization rules
   - Wrap-up steps (formatting, committing)
   - When to delegate to subagents

On `ralph init`, the following are copied:

- `.ralph/workflow.md` - Customizable workflow instructions
- `.claude/skills/manage-tasks/SKILL.md` - Task management skill for UI
- `.claude/agents/` - Subagent prompts (make-tests, write-docs, run-tests)

Auto-generated during runs:

- `.ralph/events-*.jsonl` - JSONL event stream for debugging/replay

### The Contract with Claude CLI

Ralph expects Claude CLI to:

- Output `--output-format stream-json` with `--include-partial-messages`
- Exit with code 0 on success
- Output `<promise>COMPLETE</promise>` when no issues are ready

Claude is instructed (via core-prompt + workflow) to:

- Check build/tests first, create bug issue if errors found
- Run `bd ready` to find available issues
- Claim one issue with `bd update --status=in_progress`
- Output `<start_task>{id}</start_task>` when starting
- Complete the task, run wrap-up steps
- Close the issue with `bd close {id}`
- Output `<end_task>{id}</end_task>` when done
- Output `<promise>COMPLETE</promise>` if no issues are ready

## Development Commands

```bash
# Build all packages
pnpm build

# Build shared package (required after changes to shared/)
pnpm --filter @herbcaudill/ralph-shared build

# Typecheck all packages
pnpm typecheck

# Run all tests across packages
pnpm test:all          # Run all tests (CLI + UI)
pnpm test:changed      # Run vitest with --changed flag (only affected unit tests)
pnpm test              # Run tests in each package

# Run the CLI
pnpm cli               # Run ralph CLI in development
pnpm cli:build         # Build CLI package
pnpm cli:test          # Run CLI tests

# Run the UI
pnpm ui                # Start UI dev server (Vite)
pnpm serve             # Start server only
pnpm ui:build          # Build UI for production
pnpm ui:test           # Run UI tests
pnpm test:pw           # Run Playwright with dynamic ports (uses scripts/dev.js)
pnpm --filter @herbcaudill/ralph-ui dev:headless  # Start UI without opening a browser
# Playwright dev server output logs to ui/test-results/playwright-dev.log

# Run server + UI together
pnpm dev               # Start both server and UI concurrently

# Storybook
pnpm storybook         # Start Storybook for UI components

# Format code with Prettier
pnpm format

# Editor config
# Use ui/server/tsconfig.json when editing UI server TypeScript files

# Publish CLI + UI packages
pnpm pub

# UI package publishes as public
pnpm --filter @herbcaudill/ralph-ui publish --access public
```

## Workspace Structure

This is a pnpm workspace with three packages:

- **`cli/`** (`@herbcaudill/ralph`) - The CLI tool (published to npm)
- **`ui/`** (`@herbcaudill/ralph-ui`) - Web app with server and React frontend (published to npm)
- **`shared/`** (`@herbcaudill/ralph-shared`) - Shared utilities and types used by CLI and UI

### CLI Package (`cli/`)

The autonomous AI session engine that wraps Claude CLI:

- Spawns Claude CLI with custom prompts
- Captures streaming JSON output
- Displays formatted terminal UI using Ink (React for CLIs)
- Orchestrates multiple sessions

### UI Package (`ui/`)

Web app with integrated Express server and React frontend:

- **Server** (`ui/server/`):
  - REST API for workspace management
  - WebSocket server for real-time event streaming
  - `RalphManager` - Spawns and manages Ralph CLI processes
  - `BdProxy` - Proxy for beads CLI commands
  - `ClaudeAdapter`/`CodexAdapter` - SDK-backed agent adapters for Claude and Codex
  - Theme discovery from VS Code installations
- **Frontend** (`ui/src/`):
  - Real-time event stream viewer
  - Task chat shows tool uses and results during responses
  - Task sidebar with beads integration
  - Workspace switcher for multiple projects
  - Theme support (VS Code theme integration)
  - ToolUseCard renders Bash output as plain text after stripping ANSI codes
  - Bash tool output strips ANSI color codes before display
  - Extended thinking blocks support for Claude's internal reasoning

**Extended Thinking Support:**

The UI supports Claude's extended thinking (internal monologue) blocks:

- **`ThinkingBlock`** component (`ui/src/components/events/ThinkingBlock.tsx`) - Renders thinking content
- **Types**: `AssistantThinkingContentBlock` and `StreamingThinkingBlock` in `ui/src/types.ts`
- **Features**:
  - Collapsible display (collapsed by default to reduce visual prominence)
  - Brain icon indicator
  - Muted/italic styling to differentiate from user-facing content
  - Works in both streaming and non-streaming contexts
  - Uses MarkdownContent for rich text rendering

Run with `npx @herbcaudill/ralph-ui` after installing.

#### Multi-Agent Support

The project supports multiple coding agents through the `AgentAdapter` abstraction:

**Available Agents:**

1. **Claude** (default) - Anthropic's Claude via the Claude Agent SDK
   - Uses `@anthropic-ai/claude-agent-sdk`
   - Requires `ANTHROPIC_API_KEY` environment variable

2. **Codex** - OpenAI's Codex via the Codex SDK
   - Uses `@openai/codex-sdk`
   - `OPENAI_API_KEY` is optional if logged into the local codex CLI

**Agent Adapter Architecture:**

All agents implement the `AgentAdapter` base class (`server/AgentAdapter.ts`):

- **AgentAdapter** - Abstract base class defining the interface
- **AdapterRegistry** - Registry for discovering and instantiating adapters
- **ClaudeAdapter** / **CodexAdapter** - Concrete implementations

Each adapter normalizes native events into `AgentEvent` types:

- `AgentMessageEvent`, `AgentToolUseEvent`, `AgentToolResultEvent`, `AgentResultEvent`, `AgentErrorEvent`, `AgentStatusEvent`, `AgentThinkingEvent`

**User Messages During Sessions:**

Users can send messages to Ralph during an active session. The message format expected by the Ralph CLI:

```json
{ "type": "message", "text": "your message here" }
```

The server automatically wraps user messages in this format before sending to the Ralph CLI via stdin.

### Shared Package (`shared/`)

Shared utilities and types used by both CLI and UI packages:

- **Agent Events** (`events/`):
  - Normalized event types (`AgentMessageEvent`, `AgentToolUseEvent`, `AgentThinkingEvent`, etc.)
  - Type guards (`isAgentMessageEvent`, `isAgentToolUseEvent`, `isAgentThinkingEvent`, etc.)
  - Status types (`AgentStatus`)
- **Beads Domain Types** (`beads/`):
  - Issue types (`BdIssue`, `BdDependency`)
  - Options types (`BdListOptions`, `BdCreateOptions`, `BdUpdateOptions`)
  - Mutation events (`MutationEvent`, `MutationType`)
- **Prompt Loading** (`prompts/`):
  - `loadSessionPrompt()` - Combine core-prompt with workflow
  - `loadPrompt()` - Load prompt files with custom overrides
  - `hasCustomWorkflow()` - Check for custom workflow existence

## Project Structure

```
cli/                       # CLI package (@herbcaudill/ralph)
  src/
    cli.ts                  # Commander program definition
    index.ts                # Entry point
    components/
      App.tsx               # Root component (router)
      SessionRunner.tsx   # Spawns Claude CLI, handles sessions
      InitRalph.tsx         # Initialization flow
      EventDisplay.tsx      # Renders event stream
      eventToBlocks.ts      # Parses events → display blocks
      ToolUse.tsx           # Renders individual tool calls
    lib/
      beadsClient.ts        # Unix socket RPC client for beads daemon
      MessageQueue.ts       # Async iterable message queue
      rel.ts                # Convert absolute → relative paths
  test/
    e2e/                    # E2E tests (skipped by default)
    fixtures/               # Test fixtures
  templates/                # Template files for ralph init
    core-prompt.md          # Bundled session protocol
    workflow.md             # Default workflow → .ralph/workflow.md
    skills/                 # → symlink to .claude/skills/
    agents/                 # → symlink to .claude/agents/
  bin/ralph.js              # Published executable

ui/                        # UI package (@herbcaudill/ralph-ui)
  server/                   # Express backend
    index.ts                # Server entry point with REST API + WebSocket
    main.ts                 # Development entry point
    RalphManager.ts         # Spawns and manages Ralph CLI process
    BdProxy.ts              # Proxy for beads CLI commands
    ThemeDiscovery.ts       # Discovers VS Code themes
    lib/
      theme/                # Theme parsing and mapping utilities
  src/                      # React frontend
    components/             # React components (chat, events, tasks, layout)
    store/                  # Zustand global state
    hooks/                  # Custom React hooks
    lib/                    # Utilities and theme management
    constants.ts            # Shared UI constants
    types.ts                # Shared UI types
  bin/ralph-ui.js           # Published executable
  public/                   # Static assets
  .storybook/               # Storybook configuration

shared/                    # Shared package (@herbcaudill/ralph-shared)
  src/
    events/                 # Normalized agent event types and guards
      types.ts              # AgentEvent, AgentMessageEvent, etc.
      guards.ts             # Type guard functions
    beads/                  # Beads domain types
      types.ts              # BdIssue, BdDependency, etc.
    prompts/                # Prompt loading utilities
      loadPrompt.ts         # Load prompt with custom override support
    index.ts                # Package exports

.claude/                   # Claude Code configuration (symlinked from templates)
  skills/
    manage-tasks/
      SKILL.md              # Task management skill for UI task chat
  agents/
    make-tests.md           # Subagent prompt for test generation
    write-docs.md           # Subagent prompt for documentation
    run-tests.md            # Subagent prompt for test execution
```

## Important Implementation Details

### Event Stream Parsing

The Claude CLI outputs newline-delimited JSON. Each line is a complete JSON object representing an event (assistant message, tool use, etc.). Ralph:

- Reads stdout line-by-line
- Tries to parse each line as JSON (ignoring incomplete lines)
- Appends valid events to state and log file
- Continues until stdout closes

### Relative Path Rendering

In the CLI UI, tool paths are rendered relative to the current workspace. Set `RALPH_CWD` to override the base path for relative rendering; otherwise it uses `process.cwd()`.

### Session Completion Logic

An session ends when:

1. The `claude` process exits (stdout closes AND process closes)
2. Exit code is checked - non-zero exits the entire program with error
3. If output contains `<promise>COMPLETE</promise>`, exit entire program successfully
4. Otherwise, start next session after 500ms delay

### Initialization Detection

On startup, `SessionRunner` combines core-prompt.md (bundled) with .ralph/workflow.md (if it exists, otherwise uses bundled default). This allows Ralph to run without requiring `ralph init` first.

## Testing

Ralph has comprehensive test coverage across all three packages:

```bash
pnpm test:all          # Run all tests (CLI: 169, Server: 309, UI: 996+)
pnpm cli:test          # Run CLI tests only
pnpm server:test       # Run server tests only
pnpm ui:test           # Run UI tests only
```

### CLI Tests (`cli/test/`)

- Utility functions: `rel.ts`, `shortenTempPaths.ts`, `eventToBlocks.ts`
- React components (using `ink-testing-library`): `Header.tsx`, `ToolUse.tsx`, `StreamingText.tsx`
- E2E tests (skipped by default, require Claude CLI with API key)

### Server Tests (`server/`)

- Theme discovery and parsing
- Theme API endpoints
- WebSocket communication

### UI Tests (`ui/src/`)

- React component tests
- Store tests
- E2E tests with Playwright

### UI Conventions

- Components lead files; helper functions live in `ui/src/lib` (one function per file).
- Standalone subcomponents live in their own files next to the parent component.
- Shared types and constants live in `ui/src/types.ts` and `ui/src/constants.ts`.

## UI Architecture

### Controller/Presentational Pattern

Ralph UI uses a **controller/presentational pattern** to separate concerns:

- **Presentational components**: Pure components that receive all data via props
- **Controller components**: Thin wrappers that connect presentational components to hooks
- **Domain hooks**: Encapsulate store access, API calls, and business logic

**Naming Convention:**

- **FooController** - Controller component that connects hooks to presentational component
- **Foo** - Presentational component that receives all data via props

**File Structure:**

```
src/components/chat/
├── TaskChat.tsx              # Presentational component
├── TaskChat.stories.tsx      # Storybook stories (test presentational)
├── TaskChat.test.tsx         # Unit tests
├── TaskChatController.tsx    # Controller component
└── ...
```

**Hooks** are organized by domain, not by component (`src/hooks/useTaskChat.ts`, etc.).

**Use a controller when:** Component needs store access, makes API calls, has complex state management, or coordinates multiple pieces of data.

**Use presentational component directly when:** All data can be passed via props, component is purely visual, or component is used in Storybook.

**Storybook stories test presentational components directly** - no store mocking needed.

### Storybook Decorators

Storybook decorators are defined in `.storybook/decorators.tsx`:

- **`withStoreState(state)`** - Initialize Zustand store with specific state for stories
- **`fullPageDecorator`** - Render story in a full-page container
- **`withImportedState(url)`** - Load state from a compressed `.json.gz` file before rendering

**`withImportedState` Decorator:**

Use this decorator to reproduce issues by loading exported application state:

```tsx
import { withImportedState } from "../../../.storybook/decorators"

export const ReproduceIssue: Story = {
  decorators: [withImportedState("/fixtures/reproduce-h5j8.json.gz")],
}
```

The decorator:

- Fetches and decompresses the gzipped state file
- Restores localStorage (Zustand state) and IndexedDB (sessions, events)
- Shows loading/error states while importing
- Cleans up imported state on unmount

State files should be placed in `public/fixtures/` and can be generated using the export functionality.

### State Export Format

The UI can export complete application state for debugging and Storybook stories. Export via the Settings dropdown or call `downloadStateExport()` programmatically.

**Type Definition:** `ExportedState` in `ui/src/lib/exportState.ts`

**Structure:**

```typescript
interface ExportedState {
  meta: {
    exportedAt: string // ISO timestamp
    version: 1 // Export format version
    indexedDbSchemaVersion: number // Schema version (currently 8)
    localStorageKey: string // "ralph-ui-store"
  }
  localStorage: {
    state: {
      /* Zustand persisted state */
    }
    version: number
  }
  indexedDb: {
    sessions: PersistedSession[] // Session metadata
    events: PersistedEvent[] // All events (98% of file size)
    chat_sessions: PersistedTaskChatSession[]
    sync_state: SyncState[]
  }
}
```

**Working with large exports (50MB+):**

Events dominate file size. Analyze programmatically:

```javascript
const fs = require("fs")
const data = JSON.parse(fs.readFileSync("ralph-state-*.json", "utf8"))

// Size breakdown
const eventsSize = JSON.stringify(data.indexedDb.events).length
console.log(`Events: ${(eventsSize / 1024 / 1024).toFixed(1)} MB`)

// Event type distribution
const types = {}
for (const e of data.indexedDb.events) {
  types[e.event?.type] = (types[e.event?.type] || 0) + 1
}
console.log(types) // { stream_event: 5919, assistant: 5115, user: 3873, ... }

// Find events for a specific session
const sessionEvents = data.indexedDb.events.filter(e => e.sessionId === "default-123")
```

**Import/Export utilities:**

- `exportState()` - Export current state as `ExportedState` object
- `downloadStateExport(filename?)` - Export and trigger browser download
- `importState(state)` - Restore state from `ExportedState`
- `importStateFromUrl(url)` - Fetch `.json.gz` and import
- `clearImportedState()` - Clean up after Storybook stories

**For Storybook:** Compress exports with gzip, place in `public/fixtures/`, use `withImportedState` decorator.

### IndexedDB Schema (v8)

Four object stores:

| Store           | Purpose                                          | Key Indexes                                                                                            |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `sessions`      | Session data (metadata only, events separate)    | `by-instance`, `by-started-at`, `by-instance-and-started-at`, `by-task`, `by-workspace-and-started-at` |
| `events`        | Individual events (shared by sessions and chats) | `by-session`, `by-timestamp`                                                                           |
| `chat_sessions` | Task chat session data (unified store)           | `by-instance`, `by-task`, `by-updated-at`, `by-instance-and-task`, `by-workspace-and-updated-at`       |
| `sync_state`    | Key-value settings                               | Primary key: `key`                                                                                     |

**Persistence uses two hooks:**

- **`useSessionPersistence`** - Persists session metadata on session boundaries
- **`useEventPersistence`** - Append-only writes of individual events as they arrive

**Session ID Management:**

`useSessionPersistence` is the **single source of truth** for session IDs. When a new session starts (detected by a `ralph_session_start` event), the hook:

1. Uses the server-generated `sessionId` from the event if available
2. Falls back to generating a stable session ID: `{instanceId}-{timestamp}` (legacy format)
3. Syncs the ID to `ralphConnection.ts` via `setCurrentSessionId(instanceId, sessionId)`

Server-generated session IDs are preferred because they ensure consistency between the CLI and UI. The fallback format maintains backward compatibility with older CLI versions that don't include session IDs in events.

`ralphConnection.ts` does NOT generate session IDs internally. It relies entirely on `useSessionPersistence` to set session IDs via the `setCurrentSessionId` export. This prevents dual session ID tracking bugs where events could be persisted with mismatched session IDs.

**HMR State Preservation:**

`ralphConnection.ts` uses `import.meta.hot.data` to preserve its singleton WebSocket connection state across Vite hot module reloads. Without this, HMR would reset the module-level variables (WebSocket instance, initialized flag, etc.), creating orphaned connections that produce duplicate events in the UI. The app also does not use React's `<StrictMode>` wrapper, since StrictMode's double-invocation of effects in development can interfere with the singleton WebSocket connection that lives outside React's lifecycle.

**Session ID Restoration on Hydration:**

On page reload, `useStoreHydration` restores the `currentSessions` Map in `ralphConnection.ts` by calling `setCurrentSessionId(instanceId, sessionId, startedAt)` for each active session loaded from IndexedDB. This ensures that events arriving immediately after hydration can be persisted to the correct session without waiting for a new `ralph_session_start` boundary event. The optional `startedAt` parameter on `setCurrentSessionId` allows the hydration flow to restore the original session start time.

**Workspace-Scoped Hydration:**

Hydration is scoped to the current workspace. The deduplication key includes `workspaceId` so that switching workspaces triggers re-hydration rather than reusing stale data from a different workspace. For task chat sessions, the stored `currentTaskChatSessionId` is validated against the current workspace before use -- if the stored session belongs to a different workspace, it is ignored and a workspace-scoped lookup finds the most recent session for the active workspace instead. This prevents task chat from displaying messages from a different project after switching workspaces.

### Zustand Store Architecture

The UI state is managed by a Zustand store (`ui/src/store/index.ts`). The store supports **multi-instance state management** where each Ralph instance has its own isolated state.

**Key Architecture:**

- `instances: Map<string, RalphInstance>` - Single source of truth for per-instance state
- `activeInstanceId: string` - Currently active/displayed instance
- Selectors read from the instances Map (e.g., `selectRalphStatus`, `selectEvents`)

**Per-Instance State (RalphInstance):**

Each instance contains: `status`, `events`, `tokenUsage`, `contextWindow`, `session`, `runStartedAt`, `currentTaskId`, `mergeConflict`, etc.

**Legacy Flat Fields (Deprecated):**

The store contains legacy flat fields (`ralphStatus`, `events`, `tokenUsage`, etc.) that duplicate data from the active instance. These are deprecated and should not be accessed directly. Instead, use the provided selectors which read from the instances Map.

**Migration Strategy:**

The codebase is undergoing a phased migration to remove the legacy flat fields:

1. **Phase 1 (Complete):** Selectors read from instances Map without fallback
2. **Phase 2:** Actions only update instances Map (remove flat field updates)
3. **Phase 3:** Remove legacy flat fields from AppState interface

**Testing Store State:**

When mocking the store in tests, include the `instances` Map with the required instance state:

```typescript
const mockInstance: RalphInstance = {
  id: DEFAULT_INSTANCE_ID,
  status: "running",
  events: [],
  // ... other fields
}
const state = {
  instances: new Map([[DEFAULT_INSTANCE_ID, mockInstance]]),
  activeInstanceId: DEFAULT_INSTANCE_ID,
  // ... other fields
}
```

**Session ID Helpers:**

The store exports two helper functions that bridge the index-based session boundary system with stable session IDs:

- `getSessionId(events, sessionIndex)` - Converts a session index to a stable session ID. Prefers the server-generated `sessionId` from `ralph_session_start` events; falls back to a deterministic `session-{timestamp}` format for legacy events. Returns `null` if the index is out of bounds.
- `getSessionIndexById(events, sessionId)` - Reverse lookup: maps a stable session ID back to its index in the session boundaries array. Returns `null` if not found.

Both functions use `getSessionBoundaries()` internally to locate session boundary events.

### Event Logs

Standalone snapshots saved when sessions complete:

1. Task closes → `saveEventLogAndAddComment()` saves events to IndexedDB
2. Closing comment added: `Closed. Event log: /session/abcd1234`
3. `EventLogLink` renders these as clickable links
4. `useEventLogRouter` handles navigation via URL path (legacy `#session=...` and `#eventlog=...` hash-based links are also supported for backward compatibility)

### WebSocket Events

All broadcast messages include `instanceId`, `workspaceId`, and `timestamp`. The `workspaceId` enables cross-workspace event correlation and client-side persistence tracking.

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Claude agent
- `OPENAI_API_KEY` - Optional for Codex agent (uses local codex CLI auth if absent)
- `HOST` - Server host (default: 127.0.0.1)
- `PORT` - Server port (default: 4242)
- `RALPH_DEBUG` - Enable debug logging (see Debug Logging section)
- `RALPH_CWD` - Override base path for relative path rendering

## Terminology

**Sessions** - Previously called "iterations" throughout the codebase. This refers to a single autonomous work cycle where Ralph spawns an agent to complete a task. The database table was renamed from `iterations` to `sessions` to reflect this terminology.
