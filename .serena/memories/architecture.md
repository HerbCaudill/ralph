# Architecture

## Core Flow
1. **CLI entry** (`packages/cli/src/cli.ts`) — Main mode, watch mode, agent selection, init, replay
2. **Session runner** (`packages/cli/src/components/SessionRunner.tsx`) — Spawns `claude` CLI with `--output-format stream-json`, parses events, writes to `.ralph/events-*.jsonl`
3. **Event processing** (`packages/cli/src/components/eventToBlocks.ts`) — Transforms raw JSON events into display blocks
4. **Display** (`EventDisplay.tsx`, `ToolUse.tsx`) — Renders via Ink

## UI Package
- **Server** (`packages/ui/server/`) — Express 5 + WebSocket
  - `RalphManager.ts` — Spawns/manages Ralph CLI processes
  - `ClaudeAdapter.ts`, `CodexAdapter.ts` — Agent adapters (extend `AgentAdapter.ts`)
  - `BdProxy.ts` — Proxy for beads CLI commands
  - `ThemeDiscovery.ts` — VS Code theme discovery
  - `SessionRunner.ts` — Server-side session orchestration
- **Frontend** (`packages/ui/src/`) — React 19 + Vite 7
  - `store/` — Zustand store (multi-instance via Map)
  - `hooks/` — Domain-specific hooks
  - `components/` — Organized by domain (chat, events, tasks, layout)
  - `lib/` — Utilities (one function per file)

## State Management
- Zustand store with `instances: Map<string, RalphInstance>` + `activeInstanceId`
- IndexedDB v8 for persistence (sessions, events, chat_sessions, sync_state)
- In-memory events capped at 2000

## WebSocket Protocol
- All messages include `instanceId`, `workspaceId`, `timestamp`
- Unified `agent:event` envelope with `source` field

## Template System
- Core prompt: `packages/cli/templates/core-prompt.md`
- Workflow: `.ralph/workflow.md` (repo-specific)
