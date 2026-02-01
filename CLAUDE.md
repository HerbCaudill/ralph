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
pnpm serve                # Start server only
pnpm dev                  # Start both server and UI
pnpm storybook            # Start Storybook

pnpm format               # Format with Prettier
pnpm pub                  # Publish CLI + UI packages
```

Use `packages/ui/server/tsconfig.json` when editing UI server TypeScript files.

## Workspace structure

pnpm workspace with six main packages:

- **`packages/cli/`** (`@herbcaudill/ralph`) - CLI tool (published to npm)
- **`packages/ui/`** (`@herbcaudill/ralph-ui`) - Web app with Express server and React frontend
- **`packages/shared/`** (`@herbcaudill/ralph-shared`) - Shared utilities and types
- **`packages/beads-view/`** (`@herbcaudill/beads-view`) - Task management UI/state, hooks, configurable API client, and reusable Express task routes (see `plans/018-beads-view.md`). Two export paths: `@herbcaudill/beads-view` (client) and `@herbcaudill/beads-view/server` (Express task routes)
- **`packages/beads-server/`** (`@herbcaudill/beads-server`) - Standalone Express server for beads task management. Extracts beads concerns (task/label/workspace APIs, WebSocket mutation events, BdProxy/BeadsClient wrappers around `@herbcaudill/beads-sdk`, workspace registry utilities) from the UI server. Default port 4243 (configurable via `BEADS_PORT` or `PORT`). Dev: `pnpm dev` (tsx)
- **`packages/agent-server/`** (`@herbcaudill/agent-server`) - Standalone server for managing AI coding agents with HTTP and WebSocket APIs. Extracts agent-related functionality from the UI server. Default port 4244 (configurable via `AGENT_SERVER_PORT`). Dev: `pnpm dev` (tsx)

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
    core-prompt.md          # Bundled session protocol
    workflow.md             # Default workflow -> .ralph/workflow.md

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
    store/
      beadsViewStore.ts     # Zustand store for task UI state
      BeadsViewProvider.tsx  # React context provider for store
      selectors.ts          # Store selectors

packages/beads-server/                 # Beads server package
  src/
    index.ts                # Express server entry + WebSocket setup
    BdProxy.ts              # Proxy for beads CLI commands
    BeadsClient.ts          # Wrapper around @herbcaudill/beads-sdk
    getAliveWorkspaces.ts   # Workspace registry helpers
    readRegistry.ts         # Read ~/.beads/registry.json

packages/agent-server/                 # Agent server package
  src/
    index.ts                # Express server entry + WebSocket setup (startServer, getConfig, findAvailablePort)
    main.ts                 # Dev entry point
    types.ts                # AgentServerConfig, WsClient types

packages/ui/                        # UI package
  server/                   # Express backend
    index.ts                # Server entry + REST API + WebSocket (imports task routes from beads-view)
    RalphManager.ts         # Spawns and manages Ralph CLI process
    BdProxy.ts              # Proxy for beads CLI commands
    ThemeDiscovery.ts       # Discovers VS Code themes
  src/                      # React frontend
    components/             # React components (chat, events, tasks, layout)
    store/                  # Zustand global state
    hooks/                  # Custom React hooks
    lib/                    # Utilities and theme management
    constants.ts            # Shared UI constants
    types.ts                # Shared UI types

packages/shared/                    # Shared package
  src/
    events/                 # Normalized agent event types and guards
    prompts/                # Prompt loading utilities
    index.ts                # Package exports
```

## Core architecture

### Core flow

1. **CLI entry** (`cli.ts`): Main mode (`ralph [sessions]`), watch mode (`--watch`), agent selection (`--agent <name>`), init mode (`ralph init`), replay mode (`--replay [file]`)

2. **Session runner** (`SessionRunner.tsx`): Combines `core-prompt.md` with `.ralph/workflow.md`, spawns `claude` CLI with `--output-format stream-json`, parses streaming JSON events, appends to `.ralph/events-*.jsonl`, detects `<promise>COMPLETE</promise>` to exit or enter watch mode

3. **Event processing** (`eventToBlocks.ts`): Transforms raw JSON events into display blocks (tool calls, file paths, React keys)

4. **Display layer** (`EventDisplay.tsx`, `ToolUse.tsx`): Renders events using Ink components

### Template system

Two-tier prompt system:

- **Core prompt** (`packages/cli/templates/core-prompt.md`) - Session lifecycle, task assignment, output tokens
- **Workflow** (`.ralph/workflow.md`) - Repo-specific build/test commands, prioritization, wrap-up steps

### Contract with Claude CLI

Ralph expects `--output-format stream-json` with `--include-partial-messages`, exit code 0 on success.

Claude outputs: `<start_task>{id}</start_task>` when starting, `<end_task>{id}</end_task>` when done, `<promise>COMPLETE</promise>` if no issues ready.

### Multi-agent support

Agents implement `AgentAdapter` base class (`server/AgentAdapter.ts`). Available: **Claude** (default, requires `ANTHROPIC_API_KEY`) and **Codex** (`OPENAI_API_KEY` optional). Each adapter normalizes native events into `AgentEvent` types defined in `packages/shared/`.

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

Browser-safe main entry (`@herbcaudill/ralph-shared`): events, VERSION. Node-only subpath (`@herbcaudill/ralph-shared/prompts`): prompt loading utilities. Beads types import from `@herbcaudill/beads-sdk`.

## Environment variables

- `ANTHROPIC_API_KEY` - Required for Claude agent
- `OPENAI_API_KEY` - Optional for Codex agent
- `HOST` / `PORT` - Server host/port (defaults: 127.0.0.1 / 4242)
- `BEADS_PORT` - Beads server port (default: 4243)
- `AGENT_SERVER_HOST` / `AGENT_SERVER_PORT` - Agent server host/port (defaults: localhost / 4244)
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
