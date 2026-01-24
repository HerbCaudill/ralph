# Client-Side Persistence and Unified Event Display

## Goal

Add full-fidelity client-side persistence for iterations and task chat sessions, with server-side buffering for seamless reconnection, and unify the event display components.

## User-Facing Capabilities

- **Page reload** - No data loss; current iteration and task chat restore exactly
- **Browser close/reopen** - No data loss; all history preserved
- **Iteration history** - Browse and review every iteration that has ever happened
- **Task → iteration linking** - Click on any closed task to review the iteration that worked on it

## Approach

### Storage: IndexedDB

- Events can be verbose (tool outputs); localStorage's 5-10MB limit is insufficient
- IndexedDB supports indexes for efficient queries by workspace, timestamp, iteration ID
- Use `idb` library for Promise-based API

### Data Model

```typescript
interface PersistedIteration {
  id: string                    // crypto.randomUUID()
  instanceId: string            // Links to RalphInstance
  workspace: string             // Workspace path for scoping
  startedAt: number
  endedAt: number | null
  taskId: string | null
  taskTitle: string | null
  endedNormally: boolean | null // null if in-progress
  events: ChatEvent[]
  tokenUsage: TokenUsage
}

interface PersistedTaskChatSession {
  id: string
  workspace: string
  startedAt: number
  endedAt: number | null
  events: ChatEvent[]
  messageCount: number
}
```

### Server Reconnection Protocol

1. Server tracks `lastDeliveredEventIndex` per WebSocket client
2. Client sends `lastEventTimestamp` on reconnect
3. Server sends `pending_events` message with missed events before resuming stream

### Unified Event Display

Both panels render events identically. The only difference is the data source:
- **EventStream** - displays iteration events from `instances.get(id).events`
- **TaskChatPanel** - displays task chat events from `taskChatEvents`

Extract the rendering into a single `EventList` component that takes `ChatEvent[]` and renders them.

## Tasks

### Phase 1: Client-Side Persistence Infrastructure

1. **Create IndexedDB storage module** - `ui/src/lib/persistence/EventDatabase.ts`
   - Schema with `iterations` and `taskChatSessions` object stores
   - Indexes: workspace, startedAt, taskId
   - Version migration support

2. **Create persistence types** - `ui/src/lib/persistence/types.ts`
   - `PersistedIteration`, `IterationMetadata`
   - `PersistedTaskChatSession`, `TaskChatSessionMetadata`

3. **Create iteration persistence hook** - `ui/src/hooks/useIterationPersistence.ts`
   - Auto-save on iteration boundary (system init event)
   - Auto-save on iteration end (ralph_task_completed, COMPLETE signal)
   - Generate stable GUID per iteration

4. **Create task chat persistence hook** - `ui/src/hooks/useTaskChatPersistence.ts`
   - Debounced auto-save on new events
   - Clear session on explicit "clear history"

5. **Hydrate store from IndexedDB on startup**
   - Load most recent active iteration (if not ended)
   - Load most recent task chat session

### Phase 2: Server-Side Event Buffering

6. **Add per-client event tracking** - `ui/server/index.ts`
   - Extend `WsClient` interface with `lastDeliveredEventIndex`
   - Track which events sent to each client

7. **Implement reconnection sync protocol** - `ui/server/index.ts`
   - Handle `reconnect` message from client with `lastEventTimestamp`
   - Send `pending_events` message with missed events

8. **Add client-side reconnection handling** - `ui/src/lib/ralphConnection.ts`
   - Track `lastEventTimestamp` locally
   - Send in reconnection handshake
   - Process `pending_events` before normal flow

### Phase 3: Unified Event Display

9. **Create shared EventList component** - `ui/src/components/events/EventList.tsx`
    - Takes `events: ChatEvent[]` and renders them
    - Handles user messages, assistant text, tool uses, streaming
    - Used by both EventStream and TaskChatPanel

10. **Refactor EventStream to use EventList**
    - Render with `<EventList />`
    - Keep iteration bar, navigation controls as wrapper

11. **Refactor TaskChatPanel to use EventList**
    - Render with `<EventList />`
    - Keep header, chat input as wrapper

### Phase 4: History Browsing UI

12. **Iteration history panel** - `ui/src/components/events/IterationHistoryPanel.tsx`
    - List all persisted iterations (grouped by date)
    - Show metadata: task worked on, start/end time, status
    - Click to view full event stream for that iteration
    - Search/filter by task ID or title

13. **Task → iteration linking** - Enhance `TaskDetailsDialog.tsx`
    - Query IndexedDB for iterations where `taskId` matches
    - Show "View iteration" button/link on closed tasks
    - Opens iteration history viewer for that iteration

14. **Task chat session history** - `ui/src/components/chat/TaskChatHistoryPanel.tsx`
    - List past task chat sessions
    - Click to restore/view old conversations

### Phase 5: Testing & Verification

15. **Unit tests for EventDatabase** - CRUD, index queries

16. **Integration tests** - Iteration lifecycle, page reload recovery

17. **Playwright E2E tests** - Reconnection, history viewing, task→iteration linking

## Key Files

| Purpose | Path |
|---------|------|
| Store initialization | `ui/src/store/index.ts` |
| WebSocket reconnection | `ui/src/lib/ralphConnection.ts` |
| Server event tracking | `ui/server/index.ts` |
| Task chat panel | `ui/src/components/chat/TaskChatPanel.tsx` |
| Event display | `ui/src/components/events/EventDisplay.tsx` |
| Event item router | `ui/src/components/events/EventStreamEventItem.tsx` |

## Verification

1. **Page reload**: Refresh page during iteration → events restore exactly
2. **Browser restart**: Close browser, reopen → all history preserved
3. **Reconnection**: Kill WebSocket, reconnect → no duplicate/missing events
4. **History browsing**: Open iteration history → see all past iterations
5. **Task linking**: Click closed task → view the iteration that worked on it
6. **DevTools**: Application tab shows IndexedDB data with correct structure

## Design Decisions

1. **Retention policy** - Unlimited. No automatic pruning; user can manually clear if needed.

2. **Cross-tab coordination** - Defer to V2. Keep tabs independent for V1.

3. **Event compression** - Defer to V2 if storage becomes an issue.
