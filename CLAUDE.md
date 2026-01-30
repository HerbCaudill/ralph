# Agent instructions

> **Note:** `AGENTS.md` is a symlink to `CLAUDE.md`.

## Project overview

Ralph is an autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt and todo list, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple sessions.

See `spec/web-client-ux-functional-spec.md` and `spec/screenshots/` for the UX-only functional spec and supporting screenshots.

## Development commands

Use Node.js 24.x (repo pins 24.13.0 in `.prototools`).

```bash
# Build# all packages
pnpm build

## Build shared package (required after changes to packages/shared/)
pnpm --filter @herbcaudill/ralph-shared build

## Typecheck all packages
pnpm typecheck

## Run all tests across packages
pnpm test:all          # Run all tests (CLI + UI)
pnpm test:changed      # Run vitest with --changed flag (only affected unit tests)
pnpm test              # Run tests in each package

## Run the CLI
pnpm cli               # Run ralph CLI in development
pnpm cli:build         # Build CLI package
pnpm cli:test          # Run CLI tests

## Run the UI
pnpm ui                # Start UI dev server (Vite)
pnpm serve             # Start server only
pnpm ui:build          # Build UI for production
pnpm ui:test           # Run UI tests
pnpm test:pw           # Run Playwright with dynamic ports (uses scripts/dev.js)
pnpm --filter @herbcaudill/ralph-ui dev:headless  # Start UI without opening a browser
# Playwright dev server output logs to packages/ui/test-results/playwright-dev.log#

## Run server + UI together
pnpm dev               # Start both server and UI concurrently

## Storybook
pnpm storybook         # Start Storybook for UI components

## Format code with Prettier
pnpm format

## Editor config
# Use packages/#ui/server/tsconfig.json when editing UI server TypeScript files

## Publish CLI + UI packages
pnpm pub

## UI package publishes as public
pnpm --filter @herbcaudill/ralph-ui publish --access public
```

## Issue tracking (beads)

Run `bd onboard` to get started.

### Quick reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Custom beads hooks

This project has custom hooks in `.beads/hooks/`:

- **on_close** - Auto-closes parent epics when all children are closed

Note: Beads internal hooks (`on_close`, `on_create`, `on_update`) aren't automatically
called yet in beads v0.47.x. Until that feature is implemented, you can manually run
`./.beads/hooks/on_close <issue-id>` after closing.

Or use the wrapper:

```bash
./.beads/hooks/bd-close <issue-id> [--reason="..."]
```

## Workspace structure

This is a pnpm workspace with three packages:

- **`packages/cli/`** (`@herbcaudill/ralph`) - The CLI tool (published to npm)
- **`packages/ui/`** (`@herbcaudill/ralph-ui`) - Web app with server and React frontend (published to npm)
- **`packages/shared/`** (`@herbcaudill/ralph-shared`) - Shared utilities and types used by CLI and UI

### Project structure

```
packages/cli/                       # CLI package (@herbcaudill/ralph)
  src/
    cli.ts                  # Commander program definition
    index.ts                # Entry point
    components/
      App.tsx               # Root component (router)
      SessionRunner.tsx     # Spawns Claude CLI, handles sessions
      InitRalph.tsx         # Initialization flow
      EventDisplay.tsx      # Renders event stream
      eventToBlocks.ts      # Parses events -> display blocks
      ToolUse.tsx           # Renders individual tool calls
    lib/
      beadsClient.ts        # Unix socket RPC client for beads daemon
      MessageQueue.ts       # Async iterable message queue
      rel.ts                # Convert absolute -> relative paths
  test/
    e2e/                    # E2E tests (skipped by default)
    fixtures/               # Test fixtures
  templates/                # Template files for ralph init
    core-prompt.md          # Bundled session protocol
    workflow.md             # Default workflow -> .ralph/workflow.md
    skills/                 # -> symlink to .claude/skills/
    agents/                 # -> symlink to .claude/agents/
  bin/ralph.js              # Published executable

packages/ui/                        # UI package (@herbcaudill/ralph-ui)
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

packages/shared/                    # Shared package (@herbcaudill/ralph-shared)
  src/
    events/                 # Normalized agent event types and guards
      types.ts              # AgentEvent, AgentMessageEvent, etc.
      guards.ts             # Type guard functions
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

## Core architecture

### Core flow

1. **CLI entry** (`cli.ts`) defines the Commander.js program:
   - Main mode: run N sessions (`ralph [sessions]`)
   - Watch mode: watch for new beads issues after completion (`ralph --watch`)
   - Agent selection: choose agent (`ralph --agent <name>`, defaults to `claude`)
   - Init mode: set up `.ralph/` directory (`ralph init`)
   - Replay mode: replay events from log (`ralph --replay [file]`)

2. **Session runner** (`SessionRunner.tsx`) handles orchestration:
   - Combines `core-prompt.md` with `.ralph/workflow.md` (or bundled default)
   - Spawns `claude` CLI with `--output-format stream-json`
   - Parses streaming JSON events line-by-line
   - Appends events to `.ralph/events-*.jsonl`
   - Detects `<promise>COMPLETE</promise>` to exit early (or enter watch mode if `--watch`)
   - Recursively runs the next session after completion
   - In watch mode, polls beads daemon via Unix socket RPC

3. **Event processing** (`eventToBlocks.ts`) transforms raw events into display blocks:
   - Extracts tool calls (Read, Edit, Bash, Grep, Glob, TodoWrite, etc.)
   - Shortens file paths to relative paths
   - Formats tool arguments for display
   - Creates unique IDs for React keys

4. **Display layer** (`EventDisplay.tsx`, `ToolUse.tsx`) renders events using Ink components.

### Template system

Ralph uses a two-tier prompt system:

1. **Core prompt** (`packages/cli/templates/core-prompt.md`) - bundled session protocol
   - Session lifecycle (check errors -> find issue -> work -> complete)
   - Task assignment logic
   - Output tokens (`<promise>COMPLETE</promise>`, `<start_task>`, `<end_task>`)

2. **Workflow** (`.ralph/workflow.md`) - repo-specific configuration
   - Build/test commands
   - Task prioritization rules
   - Wrap-up steps (formatting, committing)
   - When to delegate to subagents

On `ralph init`, the following are copied:

- `.ralph/workflow.md` - customizable workflow instructions
- `.claude/skills/manage-tasks/SKILL.md` - task management skill for UI
- `.claude/agents/` - subagent prompts (make-tests, write-docs, run-tests)

Auto-generated during runs:

- `.ralph/events-*.jsonl` - JSONL event stream for debugging/replay

### Contract with Claude CLI

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

## Runtime interaction

### User input while running

Ralph supports sending user messages to Claude while it's working:

- **Escape** - Open a text input to send a message to Claude (press again to cancel)
- **Ctrl+T** - Open a text input to add a todo item (only if `todo.md` exists)
- **Ctrl+S** - Stop gracefully after the current session completes
- **Ctrl+P** - Pause/resume: pause after current session completes, press again to resume

User-injected messages appear in the output stream with a 📨 prefix and green color.

#### Stdin commands (JSON mode)

When running in JSON mode (`ralph --json`), commands can be sent via stdin as JSON:

- `{"type": "message", "text": "..."}` - Send a message to Claude
- `{"type": "stop"}` - Stop gracefully after current session
- `{"type": "pause"}` - Pause after current session completes
- `{"type": "resume"}` - Resume from paused state

#### Implementation details

The feature uses the Claude Agent SDK's streaming input mode. Instead of passing a string prompt to `query()`, we pass a `MessageQueue` (an async iterable) that:

1. Yields the initial prompt message
2. Receives additional messages via `push()` from the UI
3. Uses promises to block the session until new messages arrive

When a user sends a message via Escape:

1. The message is pushed to the MessageQueue for the SDK
2. A display event is added to the events state for visual feedback
3. The `eventToBlocks.ts` parser handles `user` type events and creates `user` content blocks
4. The `formatContentBlock.ts` formats user blocks with a distinctive style

See `src/lib/MessageQueue.ts` for the queue implementation.

## Debugging and dev tooling

### Debug logging

Ralph has built-in debug logging. Enable it with the `RALPH_DEBUG` environment variable:

```bash
# Enabl#e all debug logging
RALPH_DEBUG=1 ralph

## Enable specific namespace
RALPH_DEBUG=messagequeue ralph    # MessageQueue push/next/close operations
RALPH_DEBUG=session ralph         # Session lifecycle events

## Enable multiple namespaces
RALPH_DEBUG=messagequeue,session ralph
```

Debug logs are written to stderr with timestamps, so they don't interfere with normal output.

### Dev state snapshot (`.ralph/state.latest.json`)

When the UI is running in dev mode, a snapshot of all Ralph instance state is automatically written to `.ralph/state.latest.json` on every session boundary (new session start). This file is gitignored.

**What it contains:**

```json
{
  "exportedAt": "2026-01-29T12:00:00.000Z",
  "instances": [
    {
      "id": "default",
      "name": "Default",
      "agentName": "claude",
      "status": "running",
      "worktreePath": "/path/to/worktree",
      "workspaceId": "ws-1",
      "branch": "main",
      "currentTaskId": "r-abc123",
      "currentTaskTitle": "Fix bug"
    }
  ]
}
```

**How to use it for debugging:**

- `cat .ralph/state.latest.json | jq .` - View the latest state snapshot
- Check `instances[].status` to see if Ralph is running, stopped, or errored
- Check `instances[].currentTaskId` to see what task each instance is working on
- The file updates automatically on session boundaries - no browser interaction needed
- Useful in CI scripts or automated workflows that need to inspect Ralph state

**Implementation:** The `useDevStateExport` hook POSTs to `POST /api/state/export` on session transitions. The server writes the file and returns 403 in production mode. See the "Server-side state export" section below for details.

## Package details

### CLI package (`packages/cli/`)

The autonomous AI session engine that wraps Claude CLI:

- Spawns Claude CLI with custom prompts
- Captures streaming JSON output
- Displays formatted terminal UI using Ink
- Orchestrates multiple sessions

#### Event stream parsing

The Claude CLI outputs newline-delimited JSON. Each line is a complete JSON object representing an event (assistant message, tool use, etc.). Ralph:

- Reads stdout line-by-line
- Tries to parse each line as JSON (ignoring incomplete lines)
- Appends valid events to state and log file
- Continues until stdout closes

#### Relative path rendering

In the CLI UI, tool paths are rendered relative to the current workspace. Set `RALPH_CWD` to override the base path for relative rendering; otherwise it uses `process.cwd()`.

#### Session completion logic

A session ends when:

1. The `claude` process exits (stdout closes and process closes)
2. Exit code is checked - non-zero exits the entire program with error
3. If output contains `<promise>COMPLETE</promise>`, exit entirely with success
4. Otherwise, start the next session after a 500ms delay

#### Initialization detection

On startup, `SessionRunner` combines `core-prompt.md` (bundled) with `.ralph/workflow.md` (if it exists, otherwise uses bundled default). This allows Ralph to run without requiring `ralph init` first.

### UI package (`packages/ui/`)

Web app with integrated Express server and React frontend.

#### Session lifecycle events

The UI renders special XML tags from agent output as styled event cards:

- **`<start_task>`/`<end_task>`** -> `TaskLifecycleEvent` component (blue/green styling with task ID links)
- **`<promise>COMPLETE</promise>`** -> `PromiseCompleteEvent` component (purple styling, "Session Complete" label)

Both are parsed from text blocks via `parseTaskLifecycleEvent` and `parsePromiseCompleteEvent` in `packages/ui/src/lib/`, and rendered in `renderEventContentBlock` and `StreamingBlockRenderer`.

#### Extended thinking support

The UI supports Claude's extended thinking (internal monologue) blocks:

- **`ThinkingBlock`** component (`packages/ui/src/components/events/ThinkingBlock.tsx`) renders thinking content
- **Types**: `AssistantThinkingContentBlock` and `StreamingThinkingBlock` in `packages/ui/src/types.ts`
- **Features**:
  - Collapsible display (collapsed by default to reduce visual prominence)
  - Brain icon indicator
  - Muted/italic styling to differentiate from user-facing content
  - Works in both streaming and non-streaming contexts
  - Uses MarkdownContent for rich text rendering

Run with `npx @herbcaudill/ralph-ui` after installing.

#### Multi-agent support

The project supports multiple coding agents through the `AgentAdapter` abstraction.

**Available agents:**

1. **Claude** (default) - Anthropic's Claude via the Claude Agent SDK
   - Uses `@anthropic-ai/claude-agent-sdk`
   - Requires `ANTHROPIC_API_KEY` environment variable

2. **Codex** - OpenAI's Codex via the Codex SDK
   - Uses `@openai/codex-sdk`
   - `OPENAI_API_KEY` is optional if logged into the local codex CLI

**Agent adapter architecture:**

All agents implement the `AgentAdapter` base class (`server/AgentAdapter.ts`):

- **AgentAdapter** - Abstract base class defining the interface
- **AdapterRegistry** - Registry for discovering and instantiating adapters
- **ClaudeAdapter** / **CodexAdapter** - Concrete implementations

Each adapter normalizes native events into `AgentEvent` types:

- `AgentMessageEvent`, `AgentToolUseEvent`, `AgentToolResultEvent`, `AgentResultEvent`, `AgentErrorEvent`, `AgentStatusEvent`, `AgentThinkingEvent`, `AgentEventEnvelope`

#### User messages during sessions

Users can send messages to Ralph during an active session. The message format expected by the Ralph CLI:

```json
{ "type": "message", "text": "your message here" }
```

The server wraps user messages in this format before sending to the Ralph CLI via stdin.

#### UI conventions

- Components lead files; helper functions live in `packages/ui/src/lib` (one function per file)
- Standalone subcomponents live in their own files next to the parent component
- Shared types and constants live in `packages/ui/src/types.ts` and `packages/ui/src/constants.ts`
- **ChatEvent types**: The base `ChatEvent` interface (`packages/ui/src/types.ts`) uses an index signature for backward compatibility. Narrower **discriminated event interfaces** (e.g. `AssistantChatEvent`, `UserMessageChatEvent`, `ErrorChatEvent`, `SystemChatEvent`, etc.) extend `ChatEvent` with literal `type` fields and typed properties. Use type-guard functions in `packages/ui/src/lib/is*.ts` (e.g. `isAssistantMessage`, `isErrorEvent`) to narrow a `ChatEvent` to its concrete shape. Type guards use proper TypeScript type predicates (e.g. `event is AssistantChatEvent`) rather than returning plain `boolean`, so the compiler narrows automatically without manual casts. New code should use the `*ChatEvent` discriminated types; deprecated aliases (`ErrorEventData`, `UserMessageEvent`, etc.) remain for backward compatibility but should not be introduced in new code.

#### Controller/presentational pattern

Ralph UI uses a controller/presentational pattern to separate concerns:

- **Presentational components**: Pure components that receive all data via props
- **Controller components**: Thin wrappers that connect presentational components to hooks
- **Domain hooks**: Encapsulate store access, API calls, and business logic

**Naming convention:**

- **FooController** - Controller component that connects hooks to presentational component
- **Foo** - Presentational component that receives all data via props
- Avoid `*View` suffixes; the base component name is reserved for presentational components

**File structure:**

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

#### Storybook decorators

Storybook decorators are defined in `.storybook/decorators.tsx`:

- **`withStoreState(state)`** - Initialize Zustand store with specific state for stories
- **`fullPageDecorator`** - Render story in a full-page container
- **`withImportedState(url)`** - Load state from a compressed `.json.gz` file before rendering

**`withImportedState` decorator:**

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

#### State export format

The UI can export complete application state for debugging and Storybook stories. Export via the Settings dropdown or call `downloadStateExport()` programmatically.

**Type definition:** `ExportedState` in `packages/ui/src/lib/exportState.ts`

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

**Import/export utilities:**

- `exportState()` - Export current state as `ExportedState`
- `downloadStateExport(filename?)` - Export and trigger browser download
- `importState(state)` - Restore state from `ExportedState`
- `importStateFromUrl(url)` - Fetch `.json.gz` and import
- `clearImportedState()` - Clean up after Storybook stories

**For Storybook:** compress exports with gzip, place in `public/fixtures/`, use `withImportedState` decorator.

#### Server-side state export (dev only)

The UI server provides a `POST /api/state/export` endpoint (dev mode only) that writes all Ralph instance state to `.ralph/state.latest.json` in the workspace directory. This is a server-side complement to the browser-side export described above.

- Returns `403` if the server is not running in dev mode
- Serializes all instances from `RalphRegistry` and writes them to `<workspace>/.ralph/state.latest.json`
- The JSON file contains `exportedAt` (ISO timestamp) and `instances` (array of serialized instance state)
- Returns `{ ok: true, savedAt: number }` on success, or `{ ok: false, error: string }` on failure

The client-side `useDevStateExport` hook (`packages/ui/src/hooks/useDevStateExport.ts`) automatically triggers this endpoint on session boundaries (new session start) by watching `getSessionBoundaries()`. It is wired into `App.tsx` alongside other session hooks and silently no-ops in production (the server returns 403). The hook includes retry logic: if the export fails (e.g., server not ready during startup), it retries after 3 seconds and will also retry on subsequent event changes.

This is useful for automated debugging workflows and CI scripts that need a snapshot of Ralph state without browser interaction.

#### IndexedDB schema (v8)

Four object stores:

| Store           | Purpose                                          | Key Indexes                                                                                            |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `sessions`      | Session data (metadata only, events separate)    | `by-instance`, `by-started-at`, `by-instance-and-started-at`, `by-task`, `by-workspace-and-started-at` |
| `events`        | Individual events (shared by sessions and chats) | `by-session`, `by-timestamp`                                                                           |
| `chat_sessions` | Task chat session data (unified store)           | `by-instance`, `by-task`, `by-updated-at`, `by-instance-and-task`, `by-workspace-and-updated-at`       |
| `sync_state`    | Key-value settings                               | Primary key: `key`                                                                                     |

**Persistence uses three hooks:**

- **`useSessionPersistence`** - Persists session metadata on session boundaries
- **`useEventPersistence`** - Append-only writes of individual events as they arrive
- **`useDevStateExport`** - POSTs to `/api/state/export` on session boundaries to write server state to `.ralph/state.latest.json` (dev mode only)

**Eviction policy:** `EventDatabase.evictStaleData()` runs automatically on database initialization (after orphaned session cleanup). It removes completed sessions and chat sessions older than 7 days, then caps each at 200 entries by evicting the oldest completed/updated first. Active (incomplete) sessions are never evicted. Associated events are cascade-deleted when sessions are evicted.

**Event deduplication:**

`persistEventToIndexedDB()` uses `event.uuid` as the primary IndexedDB key for deduplication. Every JSONL event from the CLI carries a stable `uuid` field that is consistent across sessions. The function falls back to `event.id`, then generates a random key as a last resort. Using the stable UUID (rather than session-scoped keys like `${sessionId}-event-...`) prevents the same event from being duplicated when persisted under different sessions (r-ewtbw).

**Session ID management:**

`useSessionPersistence` is the **single source of truth** for session IDs. When a new session starts (detected by a `ralph_session_start` event), the hook:

1. Uses the server-generated `sessionId` from the event if available
2. Falls back to generating a stable session ID: `{instanceId}-{timestamp}` (legacy format)
3. Syncs the ID to `ralphConnection.ts` via `setCurrentSessionId(instanceId, sessionId)`

Server-generated session IDs are preferred because they ensure consistency between the CLI and UI. The fallback format maintains backward compatibility with older CLI versions that don't include session IDs in events.

`ralphConnection.ts` does NOT generate session IDs internally. It relies entirely on `useSessionPersistence` to set session IDs via the `setCurrentSessionId` export. This prevents dual session ID tracking bugs where events could be persisted with mismatched session IDs.

**HMR state preservation:**

`ralphConnection.ts` uses `import.meta.hot.data` to preserve its singleton WebSocket connection state across Vite hot module reloads. Without this, HMR would reset the module-level variables (WebSocket instance, initialized flag, etc.), creating orphaned connections that produce duplicate events in the UI. The app also does not use React's `<StrictMode>` wrapper, since StrictMode's double-invocation of effects in development can interfere with the singleton WebSocket connection that lives outside React's lifecycle.

**Session ID restoration on hydration:**

On page reload, `useStoreHydration` restores the `currentSessions` Map in `ralphConnection.ts` by calling `setCurrentSessionId(instanceId, sessionId, startedAt)` for each active session loaded from IndexedDB. This ensures that events arriving immediately after hydration can be persisted to the correct session without waiting for a new `ralph_session_start` boundary event. The optional `startedAt` parameter on `setCurrentSessionId` allows the hydration flow to restore the original session start time.

**Workspace-scoped hydration:**

Hydration is scoped to the current workspace. The deduplication key includes `workspaceId` so that switching workspaces triggers re-hydration rather than reusing stale data from a different workspace. For task chat sessions, the stored `currentTaskChatSessionId` is validated against the current workspace before use. If the stored session belongs to a different workspace, it is ignored and a workspace-scoped lookup finds the most recent session for the active workspace instead. This prevents task chat from displaying messages from a different project after switching workspaces.

#### Zustand store architecture

The UI state is managed by a Zustand store (`packages/ui/src/store/index.ts`). The store supports **multi-instance state management** where each Ralph instance has its own isolated state.

**Key architecture:**

- `instances: Map<string, RalphInstance>` - Single source of truth for per-instance state
- `activeInstanceId: string` - Currently active/displayed instance
- Selectors read from the instances Map (e.g., `selectRalphStatus`, `selectEvents`)

**Per-instance state (RalphInstance):**

Each instance contains: `status`, `events`, `tokenUsage`, `contextWindow`, `session`, `runStartedAt`, `currentTaskId`, `mergeConflict`, etc.

**Derived token usage and context window:**

`selectTokenUsage` and `selectContextWindow` are derived selectors that compute values from the current session's events, not from stored instance properties. This ensures:

- Token usage automatically scopes to the current session (resets on new session)
- No imperative `addTokenUsage`/`updateContextWindowUsed` calls are needed in production code
- Event addition (`addEvent`/`addEventForInstance`) is sufficient; selectors derive the rest

The stored `tokenUsage` and `contextWindow` properties on `RalphInstance` are legacy and not used by the UI selectors. Tests should use events with token usage data (e.g., `result` events with `usage` field) when testing derived selectors.

**In-memory event cap:** The `events` array in each instance is bounded to `MAX_STORE_EVENTS` (2000) entries. The `mergeEventsById()` helper accepts an optional `maxEvents` parameter (defaulting to `MAX_STORE_EVENTS`) and retains only the N most recent events after merging. This prevents unbounded memory growth in long-running sessions.

**Legacy flat fields (deprecated):**

The store contains legacy flat fields (`ralphStatus`, `events`, `tokenUsage`, etc.) that duplicate data from the active instance. These are deprecated and should not be accessed directly. Instead, use the provided selectors which read from the instances Map.

**Migration strategy:**

The codebase is undergoing a phased migration to remove the legacy flat fields:

1. **Phase 1 (complete):** Selectors read from instances Map without fallback
2. **Phase 2:** Actions only update instances Map (remove flat field updates)
3. **Phase 3:** Remove legacy flat fields from AppState interface

**Testing store state:**

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

**Session ID helpers:**

The store exports two helper functions that bridge the index-based session boundary system with stable session IDs:

- `getSessionId(events, sessionIndex)` - Converts a session index to a stable session ID. Prefers the server-generated `sessionId` from `ralph_session_start` events; falls back to a deterministic `session-{timestamp}` format for legacy events. Returns `null` if the index is out of bounds.
- `getSessionIndexById(events, sessionId)` - Reverse lookup: maps a stable session ID back to its index in the session boundaries array. Returns `null` if not found.

Both functions use `getSessionBoundaries()` internally to locate session boundary events.

#### Event logs

Standalone snapshots saved when sessions complete:

1. Task closes -> `saveEventLogAndAddComment()` saves events to IndexedDB
2. Closing comment added: `Closed. Event log: /session/abcd1234`
3. `EventLogLink` renders these as clickable links
4. `useEventLogRouter` handles navigation via URL path (legacy `#session=...` and `#eventlog=...` hash-based links are also supported for backward compatibility)

#### WebSocket events

All broadcast messages include `instanceId`, `workspaceId`, and `timestamp`. The `workspaceId` enables cross-workspace event correlation and client-side persistence tracking.

**Unified `agent:event` envelope:**

In addition to legacy wire types (`ralph:event`, `ralph:status`, `ralph:output`, `ralph:error`, `ralph:exit`), the server broadcasts a unified `agent:event` envelope (`AgentEventEnvelope`) for all agent events. The envelope includes a `source` field discriminating between `"ralph"` and `"task-chat"` origins. Task chat events are only broadcast via the unified `agent:event` envelope (with `source="task-chat"`); legacy Ralph wire types are preserved for backward compatibility.

**Client-side unified handler (`ralphConnection.ts`):**

The `handleMessage()` function in `ralphConnection.ts` processes `agent:event` envelopes through a single code path, dispatching on the `source` field (`"ralph" | "task-chat"`) of the `AgentEventEnvelope` from `@herbcaudill/ralph-shared`. Event timestamp tracking for reconnection sync uses a single `BoundedMap` with composite keys `"{source}:{instanceId}"` (e.g. `"ralph:default"`, `"task-chat:default"`), replacing the previous separate maps. The legacy `ralph:event` handler remains for backward compatibility; the legacy `task-chat:event` and `task-chat:pending_events` handlers have been removed (r-z9gpz) since the unified `agent:event` handler with `source="task-chat"` fully covers task chat events.

**Unified reconnection protocol:**

Reconnection uses a unified wire protocol with a `source` field for routing:

- **`agent:reconnect`** (client to server) - Client sends this on WebSocket reconnect to request missed events. Payload: `AgentReconnectRequest` with `source` (`"ralph" | "task-chat"`), `instanceId`, `workspaceId`, and `lastEventTimestamp`.
- **`agent:pending_events`** (server to client) - Server responds with missed events since the given timestamp. Payload: `AgentPendingEventsResponse` with `source`, `instanceId`, `workspaceId`, and `events` array.

Both types (`AgentReconnectRequest`, `AgentPendingEventsResponse`) are defined in `@herbcaudill/ralph-shared`. Legacy wire types (`reconnect`, `pending_events`, `task-chat:reconnect`) are preserved for backward compatibility. The legacy `task-chat:pending_events` client handler was removed in r-z9gpz.

**Legacy wire format translation (`packages/shared/src/events/legacyCompat.ts`):**

A backward compatibility module provides translation between legacy and unified wire formats:

- **`translateLegacyToEnvelope()`** - Converts legacy wire messages (`ralph:event`, `task-chat:*`) to unified `AgentEventEnvelope`
- **`envelopeToLegacy()`** - Converts `AgentEventEnvelope` back to legacy format for dual-broadcasting to old clients
- **`translateLegacyReconnect()`** - Converts legacy `reconnect` / `task-chat:reconnect` to `agent:reconnect`
- **Type guards** (`isLegacyWireType`, `isLegacyReconnectType`, `isLegacyPendingType`) - Identify legacy message types

The server uses `envelopeToLegacy()` in its dual-broadcast paths for Ralph events to maintain backward compatibility without duplicating wire message construction. Task chat events are no longer dual-broadcast (r-z9gpz); they use only the unified `agent:event` envelope. This module is deprecated and should be removed once all clients migrate to the unified envelope format.

### Shared package (`packages/shared/`)

Shared utilities and types used by both CLI and UI packages.

**Subpath exports:** The main entry point (`@herbcaudill/ralph-shared`) is browser-safe and only exports events and the version constant. Node-only code (prompt loading utilities that use `node:fs`) is available via a separate subpath. Beads domain types (`BdIssue`, `MutationEvent`, etc.) should be imported directly from `@herbcaudill/beads`.

- `@herbcaudill/ralph-shared` - Browser-safe: events, VERSION
- `@herbcaudill/ralph-shared/prompts` - Node-only: prompt loading utilities

**Modules:**

- **Agent events** (`events/`):
  - Normalized event types (`AgentMessageEvent`, `AgentToolUseEvent`, `AgentThinkingEvent`, etc.)
  - Type guards (`isAgentMessageEvent`, `isAgentToolUseEvent`, `isAgentThinkingEvent`, `isAgentEventEnvelope`, etc.)
  - Status types (`AgentStatus`)
- **Prompt loading** (`prompts/`) - **Node-only, import from `@herbcaudill/ralph-shared/prompts`**:
  - `loadSessionPrompt()` - Combine core-prompt with workflow
  - `loadPrompt()` - Load prompt files with custom overrides
  - `hasCustomWorkflow()` - Check for custom workflow existence

## Testing

Ralph has comprehensive test coverage across all three packages. Unit tests focus on behavioral coverage; avoid type-only guard tests.

```bash
pnpm test:all          # Run all tests (CLI: 169, Server: 309, UI: 996+)
pnpm cli:test          # Run CLI tests only
pnpm server:test       # Run server tests only
pnpm ui:test           # Run UI tests only
```

#### CLI tests (`packages/cli/test/`)

- Utility functions: `rel.ts`, `shortenTempPaths.ts`, `eventToBlocks.ts`
- React components (using `ink-testing-library`): `Header.tsx`, `ToolUse.tsx`, `StreamingText.tsx`
- E2E tests (skipped by default, require Claude CLI with API key)

#### Server tests (`server/`)

- Theme discovery and parsing
- Theme API endpoints
- WebSocket communication

#### UI tests (`packages/ui/src/`)

- React component tests
- Store tests
- E2E tests with Playwright

## Environment variables

- `ANTHROPIC_API_KEY` - Required for Claude agent
- `OPENAI_API_KEY` - Optional for Codex agent (uses local codex CLI auth if absent)
- `HOST` - Server host (default: 127.0.0.1)
- `PORT` - Server port (default: 4242)
- `RALPH_DEBUG` - Enable debug logging (see Debug logging section)
- `RALPH_CWD` - Override base path for relative path rendering

## Terminology

**Sessions** - Previously called "iterations" throughout the codebase. This refers to a single autonomous work cycle where Ralph spawns an agent to complete a task. The database table was renamed from `iterations` to `sessions` to reflect this terminology.
