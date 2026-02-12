# Agent instructions

> **Note:** `AGENTS.md` is a symlink to `CLAUDE.md`.

## Project overview

Ralph is an autonomous AI session engine that wraps the Claude CLI to run iterative development workflows. It spawns Claude CLI processes with a custom prompt and todo list, captures streaming JSON output, displays it in a formatted terminal UI using Ink (React for CLIs), and orchestrates multiple sessions.

See `spec/web-client-ux-functional-spec.md` for the UX functional spec.

## Development commands

Use Node.js 24.x (repo pins 24.13.0 in `.prototools`).

```bash
pnpm build                # Build all packages
pnpm --filter ralph-shared build  # Build shared (required after changes)
pnpm typecheck            # Typecheck all packages

pnpm test                 # Run all tests (CLI + UI)
pnpm test:unit            # All unit tests
pnpm test:unit:{pkg}      # Unit tests for one package (e.g. test:unit:ui)
pnpm test:pw              # Playwright with dynamic ports

pnpm cli                  # Run ralph CLI in development
pnpm ui                   # Start UI Vite server only (no backends)
pnpm dev                  # Start beads-server + agent-server + UI dev server
pnpm serve:beads          # Start just the beads-server (port 4243)
pnpm serve:agent          # Start just the agent-server (port 4244)
pnpm demo:agent-chat      # Run agent chat demo dev server (port 5180)
pnpm demo:beads           # Run beads task manager demo dev server (port 5181)
pnpm storybook:agent      # Start agent-view Storybook
pnpm storybook:beads      # Start beads-view Storybook

pnpm format               # Format with Prettier
pnpm pub                  # Publish CLI + UI packages
```

Use `packages/agent-server/tsconfig.json` when editing agent-server TypeScript files.

UI vitest setup polyfills `HTMLDialogElement.showModal` and `close` for dialog-based components.

## Workspace structure

pnpm workspace with these packages:

- **`packages/ralph-cli/`** (`@herbcaudill/ralph`) — CLI tool (published to npm)
- **`packages/ralph-ui/`** (`@herbcaudill/ralph-ui`) — Web UI with React frontend and SharedWorker for loop orchestration
- **`packages/ralph-shared/`** (`@herbcaudill/ralph-shared`) — Shared utilities, types, and prompt templates
- **`packages/beads-sdk/`** (`@herbcaudill/beads-sdk`) — Typed TypeScript SDK for the beads issue tracker
- **`packages/beads-view/`** (`@herbcaudill/beads-view`) — Task management UI/state/hooks. Two export paths: main (client) and `/server` (Express task routes)
- **`packages/beads-server/`** (`@herbcaudill/beads-server`) — Express server for task management (port 4243)
- **`packages/agent-view/`** (`@herbcaudill/agent-view`) — Agent chat UI components, event schema (Effect Schema), hotkeys, hooks
- **`packages/agent-server/`** (`@herbcaudill/agent-server`) — Generic agent chat server with JSONL persistence, multi-adapter support (port 4244)
- **`packages/agent-demo/`** (`@herbcaudill/agent-demo`) — Functional chat demo
- **`packages/beads-demo/`** (`@herbcaudill/beads-demo`) — Functional task manager demo

## Core architecture

### CLI flow

1. **CLI entry** (`cli.ts`): Main mode (`ralph [sessions]`), watch mode (`--watch`), agent selection (`--agent <name>`), init mode (`ralph init`), replay mode (`--replay [file]`)
2. **Session runner** (`SessionRunner.tsx`): Combines `core.prompt.md` with `.ralph/workflow.prompt.md`, spawns `claude` CLI with `--output-format stream-json`, parses streaming JSON events, appends to `.ralph/events-*.jsonl`, detects `<promise>COMPLETE</promise>` to exit or enter watch mode
3. **Event processing** (`eventToBlocks.ts`): Transforms raw JSON events into display blocks
4. **Display layer** (`EventDisplay.tsx`, `ToolUse.tsx`): Renders events using Ink components

### Template system

All prompt templates live in `packages/ralph-shared/templates/` as the single source of truth. Templates can be imported as raw strings via Vite's `?raw` suffix:

```typescript
import MANAGE_TASKS_SYSTEM_PROMPT from "@herbcaudill/ralph-shared/templates/manage-tasks.prompt.md?raw"
```

### Contract with Claude CLI

Ralph expects `--output-format stream-json` with `--include-partial-messages`, exit code 0 on success.

Claude outputs: `<start_task>{id}</start_task>` when starting, `<end_task>{id}</end_task>` when done, `<promise>COMPLETE</promise>` if no issues ready.

### Server architecture

Two independent servers:

- **beads-server** (port 4243) — Task management REST API + WebSocket for mutation events
- **agent-server** (port 4244) — Agent chat server with adapters (Claude, Codex), session management (ChatSessionManager, SessionPersister), JSONL persistence, WebSocket streaming. Supports `customRoutes` in config for app-specific route injection.

In dev mode, `packages/ralph-ui/server/startAgentServer.ts` starts the agent-server with Ralph-specific routes injected via `customRoutes`.

The UI is frontend-only, connecting to both servers. Ralph loop orchestration happens client-side in a SharedWorker (`ralphWorker.ts`).

### Multi-agent support

Agents implement `AgentAdapter` base class. Available: **Claude** (default, requires `ANTHROPIC_API_KEY`) and **Codex** (`OPENAI_API_KEY` optional). Each adapter normalizes native events into `AgentEvent` types. Core event types are defined in `@herbcaudill/agent-view` and re-exported by `packages/ralph-shared/`.

### Context file loading

The agent-server loads adapter-specific context files and prepends them to system prompts:

| Adapter  | Context file | Global directory |
| -------- | ------------ | ---------------- |
| `claude` | CLAUDE.md    | `~/.claude/`     |
| `codex`  | AGENTS.md    | `~/.codex/`      |

Load order: user global → workspace → working directory context → caller-provided `systemPrompt`. Key exports from `@herbcaudill/agent-server`: `loadContextFile()`, `assemblePrompt()`, `getContextFilename()`.

### Session persistence

Sessions are stored as JSONL files in `~/.local/share/ralph/agent-sessions/{workspace}/{app}/{sessionId}.jsonl`, where `{workspace}` is an `owner/repo` identifier derived from the working directory (via `getWorkspaceId`) and `{app}` is an app namespace (e.g., `ralph` for Ralph loop sessions, `task-chat` for task chat sessions). Both workspace and app are optional for backward compatibility — legacy sessions at `{app}/{sessionId}.jsonl` are still found by the persister. The session ID comes from the Claude Agent SDK's init message. `SessionPersister` and `getDefaultStorageDir` are available at `@herbcaudill/ralph-shared/server` (Node-only, uses `node:fs` and `node:os`) and are used by both CLI and agent-server. Per-workspace session IDs persist in localStorage. On reconnect, the server sends `pending_events` (even if empty) to signal restoration is complete.

Session history for both Ralph and task-chat is fetched from the server via `GET /api/sessions?app={app}` rather than localStorage, ensuring consistent data across browser tabs and sessions. Task-chat uses `include=summary` so sessions without a task ID can show the first user message in the session picker.
Task-chat sessions are read-only for file editing: session creation passes an `allowedTools` allowlist that excludes file-editing tools (`Edit`, `Write`, `NotebookEdit`) while keeping investigation tools (read/search/bash).

### Concurrent workers

`WorktreeManager`, `WorkerLoop`, `WorkerOrchestrator`, and `WorkerOrchestratorManager` (all in `packages/agent-server/src/lib/`) manage concurrent Ralph workers via git worktrees. Workers use Simpsons character names (`WORKER_NAMES` from shared). Each worker creates a worktree branch (`ralph/{name}/{task-id}`), spawns an agent session, merges back to main, runs tests, and cleans up. The orchestrator manages a pool of up to N workers.

`WorkerOrchestratorManager` integrates with `ChatSessionManager` to create agent sessions instead of spawning CLI processes directly. When a `sessionManager` option is provided, sessions are created via `ChatSessionManager.createSession()`, the Ralph prompt is loaded via `loadSessionPrompt`, and the task assignment is sent as the initial message. This enables event streaming through the existing WebSocket pipeline. The manager emits a `session_created` event with `{ workerName, sessionId, taskId }` when a new session starts, or `session_resumed` when resuming an incomplete session.

Session resume functionality: When `storageDir` is provided, the manager checks for incomplete sessions before creating new ones. `findIncompleteSession(taskId, app, storageDir)` scans JSONL session files for sessions that have a `<start_task>` marker but no corresponding `<end_task>` marker. If found, the existing session is resumed with a prompt telling the agent to continue from where it left off, rather than starting over.

The UI layer uses `useWorkerOrchestrator` hook (in `packages/ralph-ui/src/hooks/`) to connect to the orchestrator via WebSocket, receiving real-time state updates for all workers. The hook tracks `activeSessionIds` and `latestSessionId` to enable session dropdown spinners and auto-selection when new sessions are created. An `onSessionCreated` callback option allows the caller to respond to new sessions (e.g., refetch session list, auto-select). The `WorkerControlBar` component displays active workers with per-worker pause/resume/stop controls and a global stop-after-current button.

## Runtime interaction (CLI)

- **Escape** — Send a message to Claude
- **Ctrl+T** — Add a todo item (if `todo.md` exists)
- **Ctrl+S** — Stop after current session
- **Ctrl+P** — Pause/resume

JSON mode (`ralph --json`) accepts stdin commands: `{"type": "message", "text": "..."}`, `{"type": "stop"}`, `{"type": "pause"}`, `{"type": "resume"}`.

## UI conventions

- Components lead files; helpers in `packages/ralph-ui/src/lib` (one function per file)
- Use discriminated `*ChatEvent` interfaces with type-guard functions in `packages/agent-view/src/lib/is*.ts`
- Controller/presentational pattern: **FooController** connects hooks to **Foo** (pure presentational)
- Use the shared Dialog component from `@herbcaudill/components` instead of native `<dialog>` elements
- Zustand store uses multi-instance state via `instances: Map<string, RalphInstance>` with `activeInstanceId`; use selectors (e.g., `selectRalphStatus`, `selectEvents`)
- `beads-view` persists task caches per workspace (`taskCacheByWorkspace`) and hydrates from the selected workspace cache on switch to prevent cross-workspace stale task flashes.
- Task detail comments are cached client-side by `workspace::taskId`, hydrate immediately from cache, then revalidate from `/api/tasks/:id/comments`.
- IndexedDB (v8) stores: `sessions`, `events`, `chat_sessions`, `sync_state`. Event dedup uses `event.uuid` as key.
- HMR preserves WebSocket state via `import.meta.hot.data`; no `<StrictMode>` wrapper
- Ralph loop idle UI: when no events are present and `controlState` is `idle`, render the "Ralph is not running" empty state even if connection status is `connecting`.
- Deprecated aliases (`ErrorEventData`, `UserMessageEvent`, etc.) exist — don't use in new code
- In task chat, keep `New chat` enabled while a session is streaming so users can start a parallel chat; switching back restores streaming state from session status.

## Environment variables

- `ANTHROPIC_API_KEY` — Required for Claude agent
- `OPENAI_API_KEY` — Optional for Codex agent
- `BEADS_PORT` — Beads server port (default: 4243)
- `AGENT_SERVER_HOST` / `AGENT_SERVER_PORT` — Agent server host/port (defaults: localhost / 4244)
- `VITE_BEADS_SERVER_URL` — Full URL for beads-server (e.g., `http://localhost:4243`)
- `VITE_AGENT_SERVER_URL` — Full URL for agent-server (e.g., `http://localhost:4244`)
- `CLAUDE_MODEL` — Override Claude model for ClaudeAdapter (defaults to `claude-opus-4-6` via `DEFAULT_CLAUDE_MODEL`). Overridable per-adapter via `ClaudeAdapterOptions.model`
- `RALPH_DEBUG` — Debug logging (`1` for all, or comma-separated namespaces: `messagequeue`, `session`)
- `RALPH_CWD` — Override base path for relative path rendering

## Terminology

**Sessions** — A single autonomous work cycle where Ralph spawns an agent to complete a task. Previously called "iterations".

## React StrictMode and WebSocket patterns

**Development-only:** In React 18 StrictMode (dev mode), components are intentionally double-mounted to catch side effects. WebSocket connections should be deferred with `setTimeout(0)` to avoid immediate teardown on the first mount, which causes ECONNRESET errors in Vite's WebSocket proxy.

This pattern is used in:

- `packages/ralph-ui/src/hooks/useWorkerOrchestrator.ts` — Defers WebSocket creation via `setTimeout(0)` with cleanup in the return function to clear the timeout
- `packages/ralph-ui/src/hooks/useRalphLoop.ts` — Follows the same pattern

The fix wraps the WebSocket constructor and handlers in a setTimeout, then clears the timeout in the cleanup function if unmounted before the deferred connection occurs.

## Reference documentation

- **Effect TS** — `vendor-docs/effect-ts.md`
- **Effect Schema** — `vendor-docs/effect-schema.md`
- **Server responsibilities map** — `docs/server-responsibilities-map.md`
