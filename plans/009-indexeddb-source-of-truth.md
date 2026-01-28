# 009: IndexedDB as Source of Truth for Sessions/Events

## Current Problems

1. **Events duplicated with wrong sessionIds** - When session changes, all events get re-saved with new sessionId
2. **Zustand and IndexedDB out of sync** - Two sources of truth that conflict after page reload
3. **Counter-based persistence is fragile** - Tracking "last saved index" breaks on session changes
4. **Session taskId not set until completion** - Dropdown shows wrong/missing tasks

## Target Architecture

**IndexedDB is the source of truth. Zustand is just a UI cache.**

```
Server (event buffer) → WebSocket → IndexedDB (source of truth) → Zustand (UI cache)
```

### Principles

1. **IndexedDB stores all sessions and events** - Persisted across page reloads
2. **Zustand is ephemeral** - Only holds current session's events for rendering, rebuilt from IndexedDB on load
3. **Only persist current session ID** - Not the events themselves (in localStorage)
4. **Events get UUIDs** - Server assigns UUID to each event for deduplication
5. **Catch-up via timestamp** - On reconnect, client sends last event timestamp, server sends newer events
6. **One task per session** - Sessions have exactly one `ralph_task_started`, or they're filtered out

## Changes

### 1. Server: Add event UUIDs and timestamp-based catch-up

**`ui/server/RalphManager.ts`** - Add UUID to events:
```typescript
export interface RalphEvent {
  id: string        // UUID assigned by server
  type: string
  timestamp: number
  [key: string]: unknown
}
```

**`ui/server/index.ts`** - Support catch-up by timestamp:
```typescript
// Handle reconnect_sync with lastEventTimestamp instead of lastEventIndex
const eventsAfterTimestamp = eventHistory.filter(e => e.timestamp > lastEventTimestamp)
```

### 2. Client: Write events directly to IndexedDB

**`ui/src/lib/ralphConnection.ts`** - When events arrive, write to IndexedDB:
```typescript
// Instead of just store.addEvent(event), also persist
await eventDatabase.saveEvent({
  id: event.id,  // Use server-assigned UUID
  sessionId: currentSessionId,
  timestamp: event.timestamp,
  event,
})
store.addEvent(event)  // Still update Zustand for UI
```

### 3. Remove useEventPersistence hook

The hook that watches Zustand and tries to diff → IndexedDB is the source of bugs. Delete it.

Events are now persisted at the point they arrive (in ralphConnection.ts).

### 4. Simplify useSessionPersistence

Only responsibilities:
- Create session record in IndexedDB when `ralph_session_start` arrives
- Update session with `taskId` when `ralph_task_started` arrives
- Mark session complete when `ralph_task_completed` or `COMPLETE` arrives

### 5. Update session taskId immediately

When `ralph_task_started` arrives:
```typescript
await eventDatabase.updateSession(sessionId, { taskId })
```

### 6. Derive taskId from events as fallback

In `useSessions` or `getSessionsForTask`:
```typescript
if (!session.taskId) {
  const events = await eventDatabase.getEventsForSession(session.id)
  const taskStartEvent = events.find(e => e.event.type === "ralph_task_started")
  if (taskStartEvent?.event.taskId) {
    await eventDatabase.updateSession(session.id, { taskId: taskStartEvent.event.taskId })
  }
}
```

### 7. Filter sessions without tasks

Sessions that never got a `ralph_task_started` are not interesting:
- Don't show them in the dropdown
- Could delete them on cleanup

## Beads Issues

Epic: **r-7i2ck** - IndexedDB as source of truth for sessions/events

Tasks (in dependency order):
1. **r-uoyap** - Add UUID to RalphEvent on server *(ready)*
2. **r-16pd6** - Support timestamp-based catch-up on reconnect *(blocked by r-uoyap)*
3. **r-5fspp** - Write events directly to IndexedDB in ralphConnection *(blocked by r-uoyap)*
4. **r-j4fbg** - Delete useEventPersistence hook *(blocked by r-5fspp)*
5. **r-8sl3x** - Update session taskId immediately on ralph_task_started *(blocked by r-5fspp)*
6. **r-67oz4** - Add taskId fallback calculation from events *(blocked by r-8sl3x)*
7. **r-hv049** - Filter sessions without tasks from dropdown *(blocked by r-67oz4)*

## Files to Modify

1. **`ui/server/RalphManager.ts`** - Add UUID to RalphEvent
2. **`ui/server/index.ts`** - Timestamp-based catch-up
3. **`ui/src/lib/ralphConnection.ts`** - Write events to IndexedDB directly
4. **`ui/src/hooks/useEventPersistence.ts`** - DELETE this file
5. **`ui/src/hooks/useSessionPersistence.ts`** - Simplify, update taskId immediately
6. **`ui/src/hooks/useSessions.ts`** - Derive taskId from events as fallback
7. **`ui/src/lib/persistence/EventDatabase.ts`** - Add `updateSession` method
8. **`ui/src/App.tsx`** - Remove useEventPersistence call

## Verification

1. Clear IndexedDB
2. Start UI, connect to workspace
3. Let Ralph run 2-3 sessions
4. Check IndexedDB:
   - Each event has unique ID and correct sessionId
   - Each session has correct taskId
5. Refresh page - sessions and events restored correctly
6. Session dropdown shows correct tasks
7. Run tests: `pnpm --filter @herbcaudill/ralph-ui test`

## Migration

For existing data in IndexedDB with duplicate events:
- Could add a cleanup script
- Or just clear IndexedDB and start fresh (data is recoverable from server's JSONL logs)
