# 010: Architecture Review

## Goal

Find architectural anti-patterns similar to the Zustand/IndexedDB dual source-of-truth problem documented in `plans/009-indexeddb-source-of-truth.md`.

## Anti-Patterns to Look For

1. **Multiple sources of truth** - State duplicated in different stores that can get out of sync
2. **Implicit dependencies** - Components/hooks that rely on side effects from other code running first
3. **Fragile state synchronization** - Counter-based tracking, index-based diffing, manual reconciliation
4. **Leaky abstractions** - Callers need to know internal details to use something correctly
5. **Tight coupling** - Changes in one area unexpectedly break another
6. **Unclear ownership** - Who's responsible for persisting X? Who initializes Y?

## Areas to Investigate

### 1. State Management (High Priority)

The IndexedDB issue suggests state management patterns may be problematic across the board.

**Questions:**
- Where else does Zustand store data that's also persisted elsewhere?
- Are there other hooks that "watch and sync" state between stores?
- What happens to in-flight state during page reload, reconnect, session change?

**Files:**
- `ui/src/store/index.ts` - Main Zustand store
- `ui/src/store/persist.ts` - Persistence middleware
- `ui/src/hooks/useSessionPersistence.ts`
- `ui/src/hooks/useEventPersistence.ts`
- `ui/src/lib/persistence/EventDatabase.ts`

### 2. WebSocket Connection & Reconnection

**Questions:**
- What state is lost on disconnect?
- Is catch-up logic correct and complete?
- Are there race conditions between reconnect and state updates?

**Files:**
- `ui/src/lib/ralphConnection.ts`
- `ui/src/hooks/useWebSocket.ts`
- `ui/src/hooks/useRalphConnection.ts`
- `ui/server/index.ts` (WebSocket handling)

### 3. Multi-Instance & Workspace Partitioning

**Questions:**
- How is state partitioned between instances?
- How is state partitioned between workspaces?
- Can instance/workspace switches cause data to leak or get lost?
- Is the "active instance" concept consistently applied?
- Are IndexedDB queries properly scoped by workspace?
- Can events/sessions from one workspace appear in another?
- What happens when switching workspaces mid-session?

**Files:**
- `ui/server/RalphRegistry.ts`
- `ui/src/store/index.ts` (instance/workspace-related state)
- `ui/src/lib/persistence/EventDatabase.ts` (workspace scoping in queries)
- `ui/src/hooks/useSessions.ts` (workspace filtering)
- Components that use `activeInstanceId` or `workspaceId`

### 4. Session Lifecycle

**Questions:**
- What defines a "session"? Is it consistent everywhere?
- How is session ID generated and propagated?
- What happens to orphaned sessions (no task, no events)?

**Files:**
- `ui/server/SessionRunner.ts`
- `ui/server/RalphManager.ts`
- `cli/src/components/SessionRunner.tsx`
- Session-related hooks

### 5. Event Flow & Processing

**Questions:**
- How many places transform/filter events before display?
- Are events ever mutated after creation?
- Is event ordering guaranteed and preserved?

**Files:**
- `ui/src/lib/eventToBlocks.ts`
- `cli/src/components/eventToBlocks.ts`
- `shared/src/events/`

### 6. Task Chat vs Ralph Sessions

**Questions:**
- How do these two systems share (or not share) state?
- Is persistence consistent between them?
- Can they interfere with each other?

**Files:**
- `ui/server/TaskChatManager.ts`
- `ui/src/hooks/useTaskChat.ts`
- `ui/src/hooks/useTaskChatPersistence.ts`

## Review Process

1. **Map the data flows** - Trace how data moves through the system
2. **Identify state boundaries** - What owns what?
3. **Test edge cases mentally** - What happens on reconnect? Instance switch? Page reload?
4. **Look for "sync" patterns** - Any hook/code that watches one store to update another
5. **Check initialization order** - Are there implicit dependencies?

## Deliverables

- List of architectural issues found (filed as beads)
- Severity ranking (critical → tech debt)
- Suggested fixes or refactoring approaches
