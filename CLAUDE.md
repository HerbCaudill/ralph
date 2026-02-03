# Agent instructions

> **Note:** `AGENTS.md` is a symlink to `CLAUDE.md`.

## Project overview

Ralph is an autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt and todo list, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple sessions.

See `spec/web-client-ux-functional-spec.md` and `spec/screenshots/` for the UX-only functional spec and supporting screenshots.

## Development commands

Use Node.js 24.x (repo pins 24.13.0 in `.prototools`).

```bash
pnpm build                # Build all packages
pnpm --filter @herbcaudill/ralph-shared build  # Build shared (required after changes)
pnpm typecheck            # Typecheck all packages

pnpm test:all             # Run all tests (CLI + UI)
pnpm test:changed         # Only affected unit tests
pnpm cli:test             # CLI tests only
pnpm ui:test              # UI tests only
pnpm test:pw              # Playwright with dynamic ports

pnpm cli                  # Run ralph CLI in development
pnpm ui                   # Start UI dev server (Vite)
pnpm serve                # Start server only (combined mode)
pnpm dev                  # Start both server and UI (combined mode)
pnpm dev:split            # Start beads-server + agent-server + ralph-server + UI as separate processes (split mode)
pnpm serve:beads          # Start just the beads-server (port 4243)
pnpm serve:agent          # Start just the generic agent-server (port 4244)
pnpm serve:ralph          # Start just the ralph-server (port 4245)
pnpm demo:agent-chat      # Run agent chat demo dev server (port 5180)
pnpm demo:beads           # Run beads task manager demo dev server (port 5181)
pnpm storybook            # Start Storybook

pnpm format               # Format with Prettier
pnpm pub                  # Publish CLI + UI packages
```

Use `packages/ui/server/tsconfig.json` when editing UI server TypeScript files. Use `packages/ralph-server/tsconfig.json` when editing ralph-server TypeScript files. Use `packages/agent-server/tsconfig.json` when editing the generic agent-server TypeScript files.

## Workspace structure

pnpm workspace with these main packages:

- **`packages/cli/`** (`@herbcaudill/ralph`) - CLI tool (published to npm)
- **`packages/ui/`** (`@herbcaudill/ralph-ui`) - Web app with Express server and React frontend
- **`packages/shared/`** (`@herbcaudill/ralph-shared`) - Shared utilities and types
- **`packages/beads-view/`** (`@herbcaudill/beads-view`) - Task management UI/state, hooks, hotkey registration, configurable API client, and reusable Express task routes (see `plans/018-beads-view.md`). Two export paths: `@herbcaudill/beads-view` (client) and `@herbcaudill/beads-view/server` (Express task routes)
- **`packages/beads-server/`** (`@herbcaudill/beads-server`) - Standalone Express server for beads task management. Extracts beads concerns (task/label/workspace APIs, WebSocket mutation events, BdProxy/BeadsClient wrappers around `@herbcaudill/beads-sdk`, workspace registry utilities) from the UI server. Default port 4243 (configurable via `BEADS_PORT` or `PORT`). Dev: `pnpm dev` (tsx)
- **`packages/agent-view/`** (`@herbcaudill/agent-view`) - Agent chat UI components, canonical event schema (Effect Schema), hotkey registration, hooks (useAgentChat, useAgentHotkeys), and reusable React context. Exports event types consumed by shared and UI packages
- **`packages/agent-server/`** (`@herbcaudill/agent-server`) - Generic agent chat server with JSONL persistence, multi-adapter support (Claude, Codex), session-based WebSocket protocol, and no built-in system prompt. Default port 4244 (configurable via `AGENT_SERVER_PORT`). Dev: `pnpm dev` (tsx)
- **`packages/ralph-server/`** (`@herbcaudill/ralph-server`) - Ralph-specific server for managing AI coding agent sessions, worktrees, and task chats. Depends on `@herbcaudill/agent-server` for adapters and utilities. Includes RalphManager, RalphRegistry, WorktreeManager, SessionRunner, TaskChatManager, and workspace context modules. Default port 4245 (configurable via `RALPH_SERVER_PORT`). Dev: `pnpm dev` (tsx)
- **`packages/agent-demo/`** (`@herbcaudill/agent-demo`) - Functional chat demo connecting to agent-server via session-based WebSocket protocol (`/ws`), sends messages, receives streaming ChatEvent objects, and renders them with the AgentView component from `@herbcaudill/agent-view`. Supports Claude Code and Codex agents, session persistence across page reloads via localStorage session index (falls back to `/api/sessions/latest`), session switching via SessionPicker and `useAgentChat.restoreSession`, displays model name in status bar via `/api/adapters` endpoint. Registers handlers for agent-view hotkey actions (focusChatInput, newSession, toggleToolOutput, scrollToBottom, showHotkeys)
- **`packages/beads-demo/`** (`@herbcaudill/beads-demo`) - Functional task manager demo using beads-view controller components (TaskSidebarController, TaskDetailsController) with useTasks/useTaskDialog hooks for data management. Registers handlers for all beads-view hotkey actions (focusSearch, focusTaskInput, previousTask, nextTask, openTask, showHotkeys) and includes a HotkeysDialog component. Vite proxy forwards /api requests to the beads-server

### Project structure

```
packages/cli/                       # CLI package
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
  templates/                # Template files for ralph init
    core.prompt.md          # Bundled session protocol
    workflow.prompt.md             # Default workflow -> .ralph/workflow.prompt.md

packages/beads-view/                   # Beads-view package (task management UI/state)
  src/
    components/
      tasks/                # Task UI components (TaskCard, TaskList, TaskSidebar, TaskDetails, etc.)
      ui/                   # Shared UI primitives (button, input, popover, command, etc.)
    hooks/
      useTasks.ts           # Task list fetching and polling
      useTaskDetails.ts     # Single-task fetching with comments/blockers
      useTaskDialog.ts      # Dialog open/close state
      useTaskDialogRouter.ts # URL hash ↔ task dialog sync
    lib/
      apiClient.ts          # Configurable API client (configureApiClient, apiFetch)
      buildTaskTree.ts      # Flat tasks → nested tree structure
      fetchTasks.ts         # API fetch helpers (fetchTasks, fetchTask, fetchBlockedTasks)
      matchesSearchQuery.ts # Client-side task search/filter
    server/
      taskRoutes.ts         # Reusable Express task routes (registerTaskRoutes)
    hotkeys/
      config.ts             # Hotkey config parser, types (BeadsHotkeyAction, HotkeyConfig, HotkeysConfig)
      hotkeys.json          # Hotkey definitions (key bindings, descriptions, categories)
      useHotkeys.ts         # useBeadsHotkeys hook, getHotkeyDisplayString utility
      index.ts              # Barrel exports
    store/
      beadsViewStore.ts     # Zustand store for task UI state
      BeadsViewProvider.tsx  # React context provider for store
      selectors.ts          # Store selectors

packages/agent-view/                   # Agent-view package (chat UI components, event schema, hotkeys)
  src/
    components/             # Agent chat UI components (AgentView, MessageBlock, ToolUseBlock, etc.)
    context/                # React context providers
    events/                 # Canonical event schema (Effect Schema)
    hooks/                  # React hooks (useAgentChat, etc.)
    hotkeys/
      config.ts             # Hotkey config parser, types (AgentHotkeyAction, HotkeyConfig, AgentHotkeysConfig)
      hotkeys.json          # Hotkey definitions (key bindings, descriptions, categories)
      useHotkeys.ts         # useAgentHotkeys hook, getHotkeyDisplayString utility
      index.ts              # Barrel exports
    lib/                    # Utility functions
    tests/                  # Test files

packages/beads-server/                 # Beads server package
  src/
    index.ts                # Express server entry + WebSocket setup
    BdProxy.ts              # Proxy for beads CLI commands
    BeadsClient.ts          # Wrapper around @herbcaudill/beads-sdk
    getAliveWorkspaces.ts   # Workspace registry helpers
    readRegistry.ts         # Read ~/.beads/registry.json

packages/agent-server/                 # Generic agent server package
  src/
    index.ts                # Barrel exports + startServer()
    main.ts                 # Dev entry point (port 4244)
    types.ts                # AgentServerConfig
    agentTypes.ts           # AgentAdapter base class, ConversationContext (no BdProxy)
    ClaudeAdapter.ts        # Claude agent adapter (Anthropic API, supports model option)
    CodexAdapter.ts         # Codex agent adapter (OpenAI API)
    AdapterRegistry.ts      # Registry mapping agent names to adapter classes
    SessionPersister.ts     # JSONL event persistence by session ID
    ChatSessionManager.ts   # Multi-session management, no built-in system prompt
    routes.ts               # HTTP routes (/api/sessions, /api/adapters, /healthz)
    wsHandler.ts            # Session-based WebSocket protocol
    findClaudeExecutable.ts # Locates the Claude CLI binary
    lib/
      isRetryableError.ts   # Retry classification for API errors
      calculateBackoffDelay.ts # Exponential backoff delay calculation
      generateId.ts         # Unique ID generation utility
      createEventStream.ts  # SSE event stream factory
      createMessageStream.ts # Message stream factory

packages/ralph-server/                 # Ralph-specific server package
  src/
    index.ts                # Express server entry + re-exports from agent-server
    main.ts                 # Dev entry point (port 4245)
    types.ts                # AgentServerConfig, WsClient types
    agentTypes.ts           # Re-exports from agent-server + BdProxy interface
    RalphManager.ts         # Spawns and manages Ralph CLI process
    RalphRegistry.ts        # Registry of all Ralph instances per workspace
    InstanceStore.ts        # JSON persistence for instance metadata
    SessionEventPersister.ts # Append-only event log persistence
    SessionStateStore.ts    # JSON persistence for session state
    SessionRunner.ts        # Orchestrates agent sessions (prompt, spawn, events)
    WorktreeManager.ts      # Git worktree creation, merge, cleanup
    systemPrompt.ts         # Loads system prompt and task-chat skill config
    loadSkill.ts            # Loads custom skill definitions from .ralph/skills/
    TaskChatManager.ts      # Manages task chat conversations
    TaskChatEventLog.ts     # In-memory event log for task chats
    TaskChatEventPersister.ts # Persistence for task chat events

packages/agent-demo/              # Agent chat demo
  src/
    App.tsx                 # Main app with AgentView, session management, agent selector, SessionPicker, hotkey handlers
    components/
      AgentSelector.tsx     # Toggle buttons for Claude Code / Codex selection
      HotkeysDialog.tsx     # Dialog showing available keyboard shortcuts (triggered by showHotkeys action)
      StatusBar.tsx         # Connection status, streaming indicator, agent type, model name, session ID, token usage display
      DemoShell.tsx         # Shared layout: header (title, subtitle, actions), sidebar, content, status bar
    hooks/
      useAdapterVersion.ts  # useAdapterInfo hook (version + model from /api/adapters), formatModelName utility

packages/beads-demo/                   # Beads task manager demo
  src/
    App.tsx                 # Main app wrapping BeadsViewProvider, TaskSidebarController, task dialog, workspace selector
    hooks/
      useWorkspace.ts       # Fetches workspace info and switching via /api/workspace endpoints
    components/
      WorkspaceSelector.tsx # Dropdown button for switching workspaces
      TaskDetailPanel.tsx   # Panel displaying task details with inline editing (wraps TaskDetailsController)
      TaskStatusBar.tsx     # Connection status, workspace path, task counts (open/closed/total)
      HotkeysDialog.tsx     # Dialog showing available keyboard shortcuts (triggered by showHotkeys action)
      DemoShell.tsx         # Shared layout: header (title, subtitle, actions), sidebar, content, status bar

packages/ui/                        # UI package
  server/                   # Express backend
    index.ts                # Server entry + REST API + WebSocket (imports task routes from beads-view)
    RalphManager.ts         # Re-export from @herbcaudill/agent-server
    RalphRegistry.ts        # Re-export from @herbcaudill/agent-server
    InstanceStore.ts        # Re-export from @herbcaudill/agent-server
    SessionEventPersister.ts # Re-export from @herbcaudill/agent-server
    SessionStateStore.ts    # Re-export from @herbcaudill/agent-server
    SessionRunner.ts        # Re-export from @herbcaudill/agent-server
    WorktreeManager.ts      # Re-export from @herbcaudill/agent-server
    findClaudeExecutable.ts # Re-export from @herbcaudill/agent-server
    systemPrompt.ts         # Re-export from @herbcaudill/agent-server
    loadSkill.ts            # Re-export from @herbcaudill/agent-server
    ClaudeAdapter.ts        # Re-export from @herbcaudill/agent-server
    CodexAdapter.ts         # Re-export from @herbcaudill/agent-server
    AdapterRegistry.ts      # Re-export from @herbcaudill/agent-server
    TaskChatManager.ts      # Re-export from @herbcaudill/agent-server
    TaskChatEventLog.ts     # Re-export from @herbcaudill/agent-server
    TaskChatEventPersister.ts # Re-export from @herbcaudill/agent-server
    isRetryableError.ts     # Re-export from @herbcaudill/agent-server
    calculateBackoffDelay.ts # Re-export from @herbcaudill/agent-server
    generateId.ts           # Re-export from @herbcaudill/agent-server
    createEventStream.ts    # Re-export from @herbcaudill/agent-server
    createMessageStream.ts  # Re-export from @herbcaudill/agent-server
    BdProxy.ts              # Proxy for beads CLI commands
    ThemeDiscovery.ts       # Discovers VS Code themes
  src/                      # React frontend
    components/             # React components (chat, events, tasks, layout)
    store/                  # Zustand global state
    hooks/                  # Custom React hooks
    lib/                    # Utilities and theme management
      serverConfig.ts       # Server URL config for dual-server architecture (combined vs split mode)
    constants.ts            # Shared UI constants
    types.ts                # Shared UI types

packages/shared/                    # Shared package
  src/
    events/                 # Agent event types (re-exported from @herbcaudill/agent-view) and guards
    prompts/                # Prompt loading utilities
    index.ts                # Package exports
```

## Core architecture

### Core flow

1. **CLI entry** (`cli.ts`): Main mode (`ralph [sessions]`), watch mode (`--watch`), agent selection (`--agent <name>`), init mode (`ralph init`), replay mode (`--replay [file]`)

2. **Session runner** (`SessionRunner.tsx`): Combines `core.prompt.md` with `.ralph/workflow.prompt.md`, spawns `claude` CLI with `--output-format stream-json`, parses streaming JSON events, appends to `.ralph/events-*.jsonl`, detects `<promise>COMPLETE</promise>` to exit or enter watch mode

3. **Event processing** (`eventToBlocks.ts`): Transforms raw JSON events into display blocks (tool calls, file paths, React keys)

4. **Display layer** (`EventDisplay.tsx`, `ToolUse.tsx`): Renders events using Ink components

### Template system

Two-tier prompt system:

- **Core prompt** (`packages/cli/templates/core.prompt.md`) - Session lifecycle, task assignment, output tokens
- **Workflow** (`.ralph/workflow.prompt.md`) - Repo-specific build/test commands, prioritization, wrap-up steps

### Contract with Claude CLI

Ralph expects `--output-format stream-json` with `--include-partial-messages`, exit code 0 on success.

Claude outputs: `<start_task>{id}</start_task>` when starting, `<end_task>{id}</end_task>` when done, `<promise>COMPLETE</promise>` if no issues ready.

### Server architecture

The server layer is split into two packages:

- **`@herbcaudill/agent-server`** (generic) — Agent adapters (ClaudeAdapter, CodexAdapter, AdapterRegistry), the AgentAdapter base class, session management (ChatSessionManager, SessionPersister), utility functions (isRetryableError, calculateBackoffDelay, generateId), and findClaudeExecutable. This package has no Ralph-specific dependencies and can be used independently.

- **`@herbcaudill/ralph-server`** (Ralph-specific) — Depends on agent-server. Contains Ralph-specific modules: RalphManager, RalphRegistry, InstanceStore, SessionEventPersister, SessionStateStore, SessionRunner, WorktreeManager, systemPrompt, loadSkill, TaskChatManager, TaskChatEventLog, TaskChatEventPersister. Also defines the BdProxy interface. Re-exports all agent-server exports for backward compatibility.

The UI server (`packages/ui/server/`) re-exports from `@herbcaudill/ralph-server` for backward compatibility.

### Dual-server mode (UI client)

The UI client supports two deployment modes:

- **Combined mode** (default): A single server on port 4242 handles everything. One WebSocket at `/ws`, all HTTP requests to the same origin. No configuration needed.
- **Split mode**: The UI connects to separate beads-server (port 4243) and agent-server (port 4244). Enabled by setting `VITE_SPLIT_SERVERS=true` or providing explicit server URLs via `VITE_BEADS_SERVER_URL` / `VITE_AGENT_SERVER_URL`.

In split mode, the UI creates two WebSocket connections: one to the agent-server (`/ws`) for agent control/chat events, and one to the beads-server (`/beads-ws` or direct URL) for task/mutation events. HTTP API paths are routed by prefix: `/api/tasks`, `/api/labels`, `/api/workspace` go to beads-server; `/api/ralph`, `/api/task-chat`, `/api/instances`, and agent control paths go to agent-server. See `packages/ui/src/lib/serverConfig.ts` for the routing logic.

The Vite dev server proxy also supports split mode: when `BEADS_PORT` and `AGENT_SERVER_PORT` env vars are set alongside `VITE_SPLIT_SERVERS=true`, Vite routes `/api/*` and `/ws` paths to the correct backend port.

### Multi-agent support

Agents implement `AgentAdapter` base class (`server/AgentAdapter.ts`). Available: **Claude** (default, requires `ANTHROPIC_API_KEY`) and **Codex** (`OPENAI_API_KEY` optional). Each adapter normalizes native events into `AgentEvent` types. Core event types (AgentEvent, AgentMessageEvent, etc.) are defined in `@herbcaudill/agent-view` and re-exported by `packages/shared/` for backward compatibility; wire protocol types remain defined locally in shared.

ClaudeAdapter accepts an optional `model` in `ClaudeAdapterOptions`, falling back to the `CLAUDE_MODEL` environment variable. Per-message model overrides the default. `AgentInfo` (returned by `getInfo()`) includes a `model` field showing the configured default.

### CLAUDE.md auto-loading

ClaudeAdapter automatically loads CLAUDE.md files and prepends their content to the system prompt. This mirrors Claude CLI behavior for consistent context across tools.

**Configuration:** Set `loadClaudeMd: false` in `ClaudeAdapterOptions` to disable (default: `true`).

**Load order:**

1. User global: `~/.claude/CLAUDE.md`
2. Workspace: `{cwd}/CLAUDE.md`
3. Working directory context (injected automatically)
4. Caller-provided `systemPrompt`

If both global and workspace files exist, their contents are combined (global first, then workspace, separated by a blank line).

**Exported utilities** (from `@herbcaudill/agent-server`):

- `loadClaudeMd(options?)` - Async function to load CLAUDE.md content
- `loadClaudeMdSync(options?)` - Sync version
- `CLAUDE_MD_FILENAME` - The constant `"CLAUDE.md"`
- `LoadClaudeMdOptions` - Type for options (`{ cwd?: string }`)

## Runtime interaction

- **Escape** - Send a message to Claude
- **Ctrl+T** - Add a todo item (if `todo.md` exists)
- **Ctrl+S** - Stop after current session
- **Ctrl+P** - Pause/resume

JSON mode (`ralph --json`) accepts stdin commands: `{"type": "message", "text": "..."}`, `{"type": "stop"}`, `{"type": "pause"}`, `{"type": "resume"}`.

Messages are delivered via `MessageQueue` (async iterable) through the Claude Agent SDK's streaming input mode.

## UI package details

### UI conventions

- Components lead files; helper functions live in `packages/ui/src/lib` (one function per file)
- Shared types in `types.ts`, constants in `constants.ts`
- Task UI state, hooks, and API client live in `packages/beads-view`; UI re-exports via `@herbcaudill/beads-view`. Server-side task routes are imported from `@herbcaudill/beads-view/server`
- Use discriminated `*ChatEvent` interfaces (e.g. `AssistantChatEvent`, `UserMessageChatEvent`) with type-guard functions in `packages/ui/src/lib/is*.ts`
- Deprecated aliases (`ErrorEventData`, `UserMessageEvent`, etc.) exist for backward compatibility — don't use in new code

### Controller/presentational pattern

- **FooController** - Thin wrapper connecting hooks to presentational component
- **Foo** - Presentational component receiving all data via props
- Hooks organized by domain (`src/hooks/useTaskChat.ts`, etc.)
- Storybook stories test presentational components directly — no store mocking needed

### Storybook decorators

Defined in `.storybook/decorators.tsx`: `withStoreState(state)`, `fullPageDecorator`, `withImportedState(url)` (loads compressed `.json.gz` state files from `public/fixtures/`).

### Zustand store architecture

Multi-instance state via `instances: Map<string, RalphInstance>` with `activeInstanceId`. Selectors read from the Map (e.g., `selectRalphStatus`, `selectEvents`). Token usage and context window are derived from session events, not stored properties.

In-memory events capped at `MAX_STORE_EVENTS` (2000). Legacy flat fields (`ralphStatus`, `events`, etc.) are deprecated — use selectors.

### IndexedDB (v8)

Four stores: `sessions`, `events`, `chat_sessions`, `sync_state`. Persistence via `useSessionPersistence` (session metadata), `useEventPersistence` (append-only events), `useDevStateExport` (dev-only server state snapshots).

Key behaviors:

- Event dedup uses `event.uuid` as IndexedDB key
- `useSessionPersistence` is the single source of truth for session IDs
- Eviction removes completed sessions/chats older than 7 days, caps at 200 each
- Hydration is workspace-scoped; `useStoreHydration` restores session IDs on reload
- HMR preserves WebSocket state via `import.meta.hot.data`; no `<StrictMode>` wrapper

### WebSocket protocol

All messages include `instanceId`, `workspaceId`, `timestamp`. Unified `agent:event` envelope (`AgentEventEnvelope`) with `source` field (`"ralph" | "task-chat"`). Reconnection via `agent:reconnect` / `agent:pending_events`. Legacy wire types preserved for backward compatibility but being phased out.

### Event logs

Task closes → `saveEventLogAndAddComment()` saves to IndexedDB → closing comment includes `/session/abcd1234` link → `useEventLogRouter` handles navigation.

## Shared package

Browser-safe main entry (`@herbcaudill/ralph-shared`): events, VERSION. Core event types (AgentEvent, AgentMessageEvent, etc.) are type aliases re-exported from `@herbcaudill/agent-view`; wire protocol types and event guards remain defined locally. Node-only subpath (`@herbcaudill/ralph-shared/prompts`): prompt loading utilities. Beads types import from `@herbcaudill/beads-sdk`.

## Environment variables

- `ANTHROPIC_API_KEY` - Required for Claude agent
- `OPENAI_API_KEY` - Optional for Codex agent
- `HOST` / `PORT` - Server host/port (defaults: 127.0.0.1 / 4242)
- `BEADS_PORT` - Beads server port (default: 4243)
- `AGENT_SERVER_HOST` / `AGENT_SERVER_PORT` - Generic agent server host/port (defaults: localhost / 4244)
- `RALPH_SERVER_HOST` / `RALPH_SERVER_PORT` - Ralph server host/port (defaults: localhost / 4245)
- `VITE_SPLIT_SERVERS` - Set to `true` to enable split-server mode in the UI (Vite build-time)
- `VITE_BEADS_SERVER_URL` - Full URL for beads-server in split mode (e.g., `http://localhost:4243`)
- `VITE_AGENT_SERVER_URL` - Full URL for agent-server in split mode (e.g., `http://localhost:4244`)
- `CLAUDE_MODEL` - Default Claude model for ClaudeAdapter (e.g., `claude-sonnet-4-20250514`). Can be overridden per-adapter via `ClaudeAdapterOptions.model`. Agent-demo Playwright tests default to `claude-haiku-4-5-20251001`
- `RALPH_DEBUG` - Debug logging (`1` for all, or comma-separated namespaces: `messagequeue`, `session`)
- `RALPH_CWD` - Override base path for relative path rendering

## Terminology

**Sessions** - A single autonomous work cycle where Ralph spawns an agent to complete a task. Previously called "iterations".

## Vendor documentation index

Reference docs for key libraries used in this project:

- **Effect TS** — `vendor-docs/effect-ts.md` — Typed functional effects, error handling, dependency injection, concurrency, resource management
- **Effect Schema** — `vendor-docs/effect-schema.md` — Type-safe data validation, parsing, transformation, encoding/decoding

## Architecture documentation

- **Server responsibilities map** — `docs/server-responsibilities-map.md` — All server routes, WebSocket channels, and types for the planned server split

<!-- BEGIN BEADS INTEGRATION -->

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->
