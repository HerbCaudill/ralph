# Package Boundary Cleanup

## Goal

Fix concern leakage across the ralph monorepo so that each package has a clear, focused responsibility. Bring beads-sdk into the monorepo. Rename ambiguous package directories to make their scope obvious.

## Context

A review found that `ralph-shared` does too much (task-chat protocol, agent-view re-exports, worker names), `agent-view` defines Ralph-specific event types, `agent-server` owns worker orchestration and Ralph-specific session analysis (both UI concerns), and `beads-sdk` lives in a separate repo. The `cli`, `ui`, and `shared` directory names don't signal they're Ralph-specific.

## Tasks

### 1. Rename cli, ui, shared directories

`packages/cli/` → `packages/ralph-cli/`, `packages/ui/` → `packages/ralph-ui/`, `packages/shared/` → `packages/ralph-shared/`. Update `pnpm-workspace.yaml`, tsconfig references, turbo.json, and scripts. npm package names stay the same.

### 2. Move beads-sdk into the monorepo

Copy `~/Code/HerbCaudill/beads-sdk/` into `packages/beads-sdk/`. Add to `pnpm-workspace.yaml`. Change all `link:../../../beads-sdk` references to `workspace:*` in beads-server, ralph-cli, and ralph-shared package.json files.

### 3. Move `getWorkspaceId` from ralph-shared to beads-sdk

Workspaces are a beads concept. Move the file and test. Update 13 import sites to `@herbcaudill/beads-sdk`. Add beads-sdk dependency to packages that need it (agent-server, beads-view, ralph-ui).

### 4. Move Ralph event types from agent-view to ralph-shared

Move `RalphTaskStarted/Completed`, `RalphSessionStart/End`, `PromiseComplete` types plus parsers (`parseTaskLifecycleEvent`, `parsePromiseCompleteEvent`) and guards (`isRalphTaskStartedEvent`, `isRalphTaskCompletedEvent`) from agent-view to ralph-shared. Update agent-view components and ralph-ui consumers to import from `@herbcaudill/ralph-shared`. Delete duplicate `parseTaskLifecycleEvent` in agent-server and ralph-cli.

### 5. Move MarkdownContent from agent-view to @herbcaudill/components

Move `MarkdownContent`, `TextWithLinks`, `CodeBlock` to `packages/components/`. Replace `useAgentViewContext()` with an `isDark` prop. Add `react-markdown` and `remark-gfm` to components' deps. Update imports in beads-view and agent-view.

### 6. Stop re-exporting agent-view types from ralph-shared

Remove `BackwardCompat<T>` wrapper types and agent-view imports from `ralph-shared/src/events/types.ts`. Change agent-server to import directly from `@herbcaudill/agent-view`.

### 7. Delete unused legacy compat layer

`ralph-shared/src/events/legacyCompat.ts` and the `AgentEventSource` type have zero consumers outside shared. Delete and clean up exports.

### 8. Move taskId extraction from agent-server to client

Ralph-specific session analysis doesn't belong in a generic agent server. Create `packages/ralph-ui/src/lib/sessionTaskIdCache.ts` with client-side taskId extraction + localStorage cache. Update `fetchRalphSessions` to use client-side cache instead of `include=summary`. Populate cache from streaming events when `<start_task>` arrives. Delete `getSessionSummary.ts`, `findIncompleteSession.ts` (dead code) from agent-server. Keep `firstUserMessage` extraction server-side (generic, used by task-chat).

### 9. Move worker names from ralph-shared to ralph-ui

`workerNames.ts` (Simpsons characters) is a UI orchestration concern. Move to `packages/ralph-ui/server/lib/`. Update imports.

### 10. Move worker orchestration from agent-server to ralph-ui/server

Make agent-server a pure agent chat server. Move `WorkerOrchestrator`, `WorkerOrchestratorManager`, `WorkerLoop`, `WorktreeManager` and `orchestratorRoutes` to `packages/ralph-ui/server/`. Extract orchestrator WS commands from agent-server's `wsHandler.ts` so it only handles session messages. Remove orchestrator exports from agent-server's index.

## Order

1 → 2 → 3 (renames, then beads-sdk, then getWorkspaceId)
4, 5, 6, 7, 8 are independent of each other
9 → 10 (worker names before orchestration move)

## Verification

After each task: `pnpm build && pnpm typecheck && pnpm test && pnpm format`

After all tasks: `pnpm dev` — UI starts, Ralph loop works, task chat works, session picker shows task IDs, worker orchestration functions.
