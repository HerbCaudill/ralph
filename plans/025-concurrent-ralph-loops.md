# Plan: Multiple Concurrent Ralph Loops

## Context

Pressing Start currently launches one Ralph loop (one Claude session at a time, sequentially working through tasks). We want it to launch N concurrent Ralph loops (configurable), each in its own git worktree, with events visible in the existing UI using the existing RalphRunner/AgentView rendering.

The codebase already has a WorkerOrchestrator system (worktree management, task assignment, worker pool) but it spawns Claude CLI silently with no event streaming. We'll make it use agent-server sessions instead, so events flow through the existing pipeline.

## Architecture

```
Press Start
  → orchestrator.start() (server-side)
  → creates N workers, each:
      1. claims a task from beads
      2. creates a git worktree
      3. creates an agent-server session (cwd = worktree)
      4. sends Ralph prompt + task assignment
      5. Claude works, events stream via existing WS
      6. on completion: merge worktree → main, close task
      7. pick next task, repeat
  → each worker's session appears in the existing session dropdown
  → multiple sessions show spinners simultaneously (one per active worker)
  → user selects a session to view its events — existing RalphRunner/AgentView unchanged
```

## Session completeness and resume

Session completeness is derived from the event log — if it contains an `<end_task>` marker, the session is complete. No marker means it was interrupted mid-task.

When a worker picks up a task:
1. Check if there's an existing incomplete session for that task (scan JSONL files for sessions with a matching task ID but no `<end_task>` marker)
2. If yes: resume it via the agent SDK's resume capability (continue the conversation where it left off)
3. If no: create a new session

## Changes

### 1. WorkerLoop: use sessions instead of CLI spawn

**File:** `packages/agent-server/src/lib/WorkerLoop.ts`

Replace `spawnClaude: (cwd: string) => ChildProcess` with:

```ts
runAgent: (cwd: string, taskId: string, taskTitle: string) =>
  Promise<{ exitCode: number; sessionId: string }>
```

The WorkerLoop doesn't need to know how Claude runs — it just gets an exit code and session ID. Remove the ChildProcess handling (`proc.on("close")`, `proc.kill()`).

For pause/resume: the callback should accept an AbortSignal or the WorkerLoop emits pause/resume that the caller handles (interrupt/resume the session).

### 2. WorkerOrchestratorManager: create sessions via ChatSessionManager

**File:** `packages/agent-server/src/lib/WorkerOrchestratorManager.ts`

Accept `ChatSessionManager` in options. Implement `runAgent` by:

1. Creating a session: `manager.createSession({ cwd: worktreePath, app: "ralph", systemPrompt })`
2. Sending the Ralph prompt + task assignment as first message
3. Waiting for session completion (status → "idle")
4. Returning `{ exitCode: 0, sessionId }`

Emit a new event `session_created: [{ workerName, sessionId, taskId }]` so the session list refreshes.

Worker identity (Simpsons names from `WORKER_NAMES`) is a server-side concern — used for task claiming (`assignee: workerName`) and worktree branch naming (`ralph/{name}/{taskId}`). The UI doesn't surface worker names; it only shows sessions and tasks.

### 3. startAgentServer.ts: pass session manager

**File:** `packages/ui/server/startAgentServer.ts`

Pass the `ChatSessionManager` instance (returned by `startServer()`) to the orchestrator factory so it can create sessions.

### 4. Start button → orchestrator

**File:** `packages/ui/src/components/WorkspaceView.tsx`

When Start is pressed, call `orchestrator.start()` instead of the single Ralph loop's `start()`. The orchestrator spins up workers based on available tasks.

### 5. Session dropdown shows multiple active sessions

**Files:** Session picker component, `useRalphSessions`

No new UI needed. Each worker's session appears in the existing session dropdown. The dropdown already shows a spinner next to the active session — with N workers, N sessions show spinners. User clicks a session to view its events in RalphRunner.

The orchestrator emits `session_created` events with `{ workerName, sessionId, taskId }` so the session list can refresh and show the new entries.

### 6. Simplify useRalphLoop or extract session subscription

**File:** `packages/ui/src/hooks/useRalphLoop.ts`

The loop management (creating sessions, detecting `<end_task>`, auto-continuation) moves server-side into the orchestrator. The client-side hook simplifies to: subscribe to a session ID, forward events to the UI. The SharedWorker's loop logic becomes unnecessary.

Option: extract a simpler `useSessionEvents(sessionId)` hook from useRalphLoop that just subscribes and returns events.

## What stays the same

- `RalphRunner` component (renders events, controls, status bar)
- `AgentView` component (event stream rendering)
- All event types and renderers
- `WorkerControlBar` (per-worker pause/resume/stop — already built)
- `WorktreeManager` (worktree create/merge/cleanup — already built)
- `WorkerOrchestrator` (worker pool management — already built)
- `createBeadsTaskSource` (task fetching — just wired up)

## What's removed/simplified

- `ralphWorker.ts` SharedWorker loop continuation logic (orchestrator handles this server-side)
- Single-session-per-workspace assumption in `useRalphLoop`
- CLI spawning in `WorkerOrchestratorManager` (`spawnClaude`, `findClaudeExecutable`)

## Configuration

Max concurrent workers configurable (default: 3). Could be a UI setting or environment variable.

## Verification

1. `pnpm dev` — start all servers
2. Create 3+ ready tasks in beads
3. Press Start in Ralph panel
4. Verify: session dropdown shows N active sessions with spinners
5. Verify: selecting a session shows its streaming events in RalphRunner
6. Verify: each worker merges its worktree back to main on task completion
7. Verify: pause/resume/stop per-worker works via WorkerControlBar
8. All existing tests pass (`pnpm test`)
