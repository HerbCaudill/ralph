# IndexedDB Data Model Rationalization - Analysis & Recommendation

## Current State Analysis

### What's Currently in IndexedDB (v2)

The existing implementation uses a **dual-store pattern** for efficiency:

**7 Object Stores:**
1. `iteration_metadata` - Fast metadata queries (id, instanceId, startedAt, completedAt, taskId, taskTitle, tokenUsage, contextWindow, eventCount)
2. `iterations` - Full iteration data with complete event streams
3. `task_chat_metadata` - Fast metadata for task chat sessions
4. `task_chat_sessions` - Full task chat with messages and events
5. `event_log_metadata` - Fast metadata for saved logs
6. `event_logs` - Full event logs with complete streams
7. `sync_state` - Key-value store for sync tracking

**Key Indexes:**
- `by-instance` - Query all data for an instance
- `by-task` - Find iterations/sessions for a task
- `by-started-at`, `by-updated-at`, `by-created-at` - Time-based sorting
- `by-instance-and-started-at`, `by-instance-and-task` - Compound indexes

### What's NOT in IndexedDB

**Workspaces:**
- Source of truth: Beads registry file (`~/.beads/registry.json`)
- Currently: Fetched from server, cached in localStorage (Zustand)
- Multi-workspace support exists at server level (WorkspaceContextManager)

**Tasks:**
- Source of truth: Beads database (`.beads/database.json` per workspace)
- Currently: Fetched via `BdProxy`, stored in Zustand, real-time updates via mutation events
- Computed fields: `blocked_by_count`, `blocked_by` recalculated on each fetch

**Instances:**
- Currently: `RalphInstance` objects in Zustand store, persisted to localStorage
- Metadata: `instanceId`, `currentTaskId`, `currentTaskTitle`, `status`, token usage, etc.

### Data Hierarchy (Current)

```
[Not in IndexedDB]
├── Workspace (from beads registry)
│   └── Tasks (from bd database)
│
[In Memory/localStorage]
└── RalphInstance (instanceId)
    └── Events (ChatEvent[])
        └── Iterations (delimited by system/init events)
            └── Task reference (taskId from ralph_task_started)

[In IndexedDB]
└── PersistedIteration
    ├── Metadata (fast queries)
    └── Events (lazy-loaded)
```

---

## Proposed Changes Analysis

### 1. Workspaces Table

**Proposed:**
```
workspaces
  - id: repo name (workspace identifier)
```

**Analysis:**
- ❌ **Not recommended** - Source of truth is beads registry file
- Adding IndexedDB store creates sync complexity
- Workspaces are lightweight metadata, localStorage sufficient
- No clear query use case that justifies IndexedDB storage
- **Risk:** Stale data if registry changes outside of Ralph UI

**Recommendation:** Keep current approach (server-fetched, localStorage cache)

### 2. Tasks Table

**Proposed:**
```
tasks
  - id: prefix + random string (e.g., "r-abc")
  - ... (task fields)
```

**Analysis:**
- ❌ **Not recommended** - Source of truth is bd database
- Tasks change frequently via bd CLI (outside Ralph)
- Real-time sync via beads daemon mutation events works well
- Computed fields (`blocked_by`) require dependency graph traversal
- **Risk:** Significant sync complexity, stale/inconsistent data

**Current approach is correct:** Server-side via BdProxy with mutation polling

### 3. Instances Table

**Proposed:**
```
instances
  - instanceId: GUID
  - name: string (e.g., "ralph")
```

**Analysis:**
- ⚠️ **Maybe useful** - Could persist instance metadata across sessions
- Currently lightweight enough for localStorage
- **Question:** What queries would this enable?
  - Cross-session instance analytics?
  - Historical instance tracking?

**Recommendation:** Only add if there's a specific query use case

### 4. Iterations with workspaceId

**Proposed:**
```
iterations
  - iterationId: GUID
  - instanceId: GUID
  - workspaceId: repo name  ← NEW
  - startedAt, completedAt
  - taskId, taskTitle
  - tokenUsage, contextWindow
```

**Analysis:**
- ✅ **Recommended** - Currently missing workspace association!
- Enables cross-workspace analytics and queries
- Supports use cases like:
  - "Show all iterations across all workspaces"
  - "Find iterations for task X in workspace Y"
  - Workspace-scoped iteration history

**Trade-off:** All existing iterations would need migration (no workspace info)

### 5. Events with Envelope

**Proposed:**
```
events
  - id: GUID
  - instanceId: GUID
  - workspaceId: repo name
  - iterationId: GUID
  - timestamp
  - event: original event object
```

**Analysis:**
- ⚠️ **Significant trade-offs:**

**Pros:**
- Enables event-level queries across iterations/workspaces
- Could support analytics: "Show all Bash tool uses across all iterations"
- Cleaner separation of concerns

**Cons:**
- **High duplication:** instanceId, workspaceId, iterationId repeated per event
- **Storage cost:** 1000+ events per iteration × metadata overhead
- **Current approach works:** Events nested in iterations is more normalized
- **Query patterns unclear:** What queries need event-level filtering that iteration-level doesn't handle?

**Questions to consider:**
- Do you need to query events independently of iterations?
- Is the storage cost worth the query flexibility?
- Could event-level indexes on iterations store achieve the same goals?

---

## Key Insights on Current Architecture

### What's Working Well

1. **Dual-store pattern (metadata + full):**
   - Fast listing without loading full event streams
   - Lazy-load events only when viewing details
   - Good separation of concerns

2. **Source of truth clarity:**
   - Workspaces: Beads registry
   - Tasks: Beads database
   - Events: Ralph generates and owns

3. **Efficient sync:**
   - Mutation events for real-time task updates
   - Reconnection sync only sends new events
   - JSONL files for append-only persistence

4. **Memory management:**
   - MAX_EVENT_HISTORY = 1000 prevents unbounded growth
   - Automatic trimming of old events

### Current Gaps

1. **No workspace association in iterations:**
   - Can't query iterations across workspaces
   - Can't filter iteration history by workspace

2. **Iteration boundary detection is O(n):**
   - Linear scan for system/init events
   - Could be optimized with metadata

3. **No event deduplication:**
   - Reconnection could potentially duplicate events
   - No mechanism to detect/prevent duplicates

---

## Current Event Storage Problem

**The inefficiency you may have noticed:**

Client-side IndexedDB saves rewrite the entire event array periodically:
- Every 10 new events → `put(iteration)` with all events
- On iteration complete → `put(iteration)` with all events
- 1000 events + 10 new = rewrite all 1010 events

**What works well:**

Server-side JSONL format is efficient:
- Append-only writes (one line per event)
- No read-modify-write cycle
- File deleted after iteration completes

---

## Understanding Your Proposal

Based on your clarification, I believe you're proposing:

```
IndexedDB Tables:
├── instances (optional - for instance metadata)
├── iterations (add workspaceId)
└── events (separate from iterations - one row per event)
    ├── id (GUID per event)
    ├── instanceId
    ├── workspaceId
    ├── iterationId
    ├── timestamp
    └── event (the actual event object)
```

**NOT proposing:**
- ❌ Workspaces table (understood - source of truth is beads registry)
- ❌ Tasks table (understood - source of truth is bd database)

**Key question:** Should events be stored separately (one IndexedDB row per event) or nested in iterations (current approach)?

---

## Trade-offs Analysis

### Option A: Separate Events Table (Your Proposal - Normalized)

**Structure:**
```typescript
events
  - id: GUID (unique per event)
  - iterationId: GUID (foreign key to iterations)
  - timestamp: number
  - event: ChatEvent (original object)

iterations
  - id: GUID
  - instanceId: string
  - workspaceId: string
  - startedAt, completedAt
  - taskId, taskTitle
  - tokenUsage, contextWindow
```

**Indexes:**
- events: `by-iteration` (for loading iteration events)
- iterations: `by-workspace`, `by-instance`, `by-task`

**Pros:**
- ✅ **Append-only writes** - new events are single `add()` operations, not rewrites
- ✅ **Minimal overhead** - only iterationId + timestamp per event (~40 bytes vs ~140 bytes)
- ✅ Enables event-level queries via join ("show all Bash tool uses")
- ✅ Can query events independently then join with iteration metadata
- ✅ More granular data access

**Cons:**
- ❌ Loading iterations requires a query + join (fetch events by iterationId)
- ❌ More complex data model (two tables instead of one)
- ❌ Migration complexity (need to flatten existing nested events)
- ❌ Event queries across workspaces need join: `events → iterations WHERE workspace`

**Storage cost example (revised):**
- 1000 events × (36-byte GUID + 8-byte timestamp) = ~44KB overhead
- vs nested approach: single set of IDs per iteration
- Much better than the denormalized approach!

### Option B: Nested Events (Current Approach - Improved)

Keep events nested in iterations but optimize the save pattern:

**Structure (unchanged):**
```typescript
iterations
  - id: GUID
  - instanceId: string
  - workspaceId: string  ← ADD THIS
  - events: ChatEvent[]
  // ... metadata
```

**Optimization:**
- Only save on iteration completion (not every 10 events)
- Let JSONL file handle durability during active iteration
- Client only persists to IndexedDB when iteration ends

**Pros:**
- ✅ Minimal storage overhead
- ✅ Simple data model
- ✅ Fast iteration loading (single get, all events included)
- ✅ Easy migration (just add workspaceId field)

**Cons:**
- ❌ Can't query events independently of iterations
- ❌ Loading all events means loading all events (can't lazy-load)
- ❌ Event-level analytics require loading full iterations first

---

## Recommendations

### Two Viable Approaches

With the normalized structure, both approaches have merit:

#### **Option A: Separate Events Table** (Better long-term)

**Schema:**
```typescript
// events table
{
  id: GUID
  iterationId: GUID
  timestamp: number
  event: ChatEvent
}

// iterations table
{
  id: GUID
  instanceId: string
  workspaceId: string  // ← ADD
  startedAt: number
  completedAt: number | null
  taskId: string | null
  taskTitle: string | null
  eventCount: number
}
```

**When to choose this:**
- You want append-only event writes (efficient)
- You plan to add event-level queries/analytics
- You want the flexibility for future features
- Migration effort is acceptable

**Migration path:**
- Create `events` table with indexes
- Migrate existing iterations: flatten events array → individual rows
- Update write pattern: `events.add()` instead of `iterations.put()`
- Update read pattern: join events by iterationId

#### **Option B: Nested Events** (Simpler, less change)

**Schema:**
```typescript
// iterations table (just add workspaceId)
{
  id: GUID
  instanceId: string
  workspaceId: string  // ← ADD
  events: ChatEvent[]  // ← KEEP NESTED
  // ... rest unchanged
}
```

**When to choose this:**
- You want minimal changes
- Event-level queries aren't a priority
- Simple queries matter more than write efficiency
- Can tolerate the periodic save inefficiency

**Changes needed:**
- Add `workspaceId` field to IterationMetadata
- Add index: `by-workspace-and-started-at`
- Optional: Remove "every 10 events" save (JSONL provides durability)

### My Recommendation

**Go with Option A (Separate Events Table)** because:

1. **Fixes the write inefficiency properly** - append-only is the right pattern
2. **Storage overhead is minimal** - only 44 bytes per event with normalization
3. **Future-proofs for analytics** - event-level queries become possible
4. **Cleaner architecture** - separation of concerns between events and iterations

The migration is one-time complexity, but the benefits compound over time.

---

## Implementation Plan

### Phase 1: Schema Update

**1. Update IndexedDB schema to version 3**
- File: `ui/src/lib/persistence/types.ts`
- Update `PERSISTENCE_SCHEMA_VERSION` from 2 to 3
- Add new `Event` and `EventMetadata` types

**2. Add `events` object store**
- File: `ui/src/lib/persistence/EventDatabase.ts`
- Create `events` store in `upgrade()` handler (version 3)
- Schema:
  ```typescript
  events: {
    key: string (event.id)
    value: PersistedEvent {
      id: string
      iterationId: string
      timestamp: number
      event: ChatEvent
    }
    indexes: {
      "by-iteration": iterationId
      "by-timestamp": timestamp
    }
  }
  ```

**3. Add `workspaceId` to iterations**
- Update `IterationMetadata` type to include `workspaceId: string | null`
- Add `workspaceId` field in schema upgrade
- Add index: `by-workspace-and-started-at: [workspaceId, startedAt]`

**4. Remove `events` array from iterations**
- Keep `eventCount` field for metadata
- Remove `events: ChatEvent[]` from `PersistedIteration` type

### Phase 2: Migration Logic

**5. Implement migration for existing data**
- File: `ui/src/lib/persistence/EventDatabase.ts`
- In version 3 upgrade handler:
  - Iterate over existing `iterations` store
  - For each iteration with `events` array:
    - Extract events and create individual `PersistedEvent` records
    - Add to `events` store with `by-iteration` index
    - Update iteration record to remove events array
    - Set `workspaceId` to null for old data (can be backfilled later)

**6. Handle workspace backfilling**
- Create utility: `backfillWorkspaceIds()`
- Read current workspace from localStorage
- Update iterations with null `workspaceId` to current workspace
- Mark as optional/manual step (since we can't know historical workspace)

### Phase 3: Update Write Patterns

**7. Update iteration persistence hook**
- File: `ui/src/hooks/useIterationPersistence.ts`
- Change from periodic saves to append-only:
  - Remove "every 10 events" save logic
  - Only save iteration metadata on completion
  - Don't save events array (will be handled separately)

**8. Add event persistence hook**
- File: `ui/src/hooks/useEventPersistence.ts` (new)
- Listen for new events in store
- Call `eventDatabase.saveEvent()` for each new event
- Pass `iterationId` from current iteration metadata

**9. Update EventDatabase methods**
- Add `saveEvent(event: PersistedEvent): Promise<void>`
- Add `saveEvents(events: PersistedEvent[]): Promise<void>` for batch
- Update `saveIteration()` to not include events array
- Ensure `workspaceId` is passed from server context

### Phase 4: Update Read Patterns

**10. Update iteration loading**
- File: `ui/src/lib/persistence/EventDatabase.ts`
- Add `getEventsForIteration(iterationId: string): Promise<PersistedEvent[]>`
- Uses `by-iteration` index for efficient lookup
- Returns events sorted by timestamp

**11. Update UI components**
- File: `ui/src/hooks/useIterations.ts`
- When loading iteration details, fetch events separately
- Combine iteration metadata with events for display
- Update type to handle separate loading

**12. Update event log viewer**
- File: `ui/src/components/history/EventLogViewer.tsx`
- Update to load events via new `getEventsForIteration()` method
- Handle loading state for events separately from metadata

### Phase 5: Server-Side Updates

**13. Pass workspaceId to client**
- File: `ui/server/WorkspaceContext.ts`
- Include `workspaceId` (workspace path) in iteration metadata
- Broadcast workspace info with events

**14. Update WebSocket event format**
- File: `ui/server/index.ts`
- Ensure `workspaceId` is included in event broadcast
- Update `RalphInstance` type to track workspace

### Phase 6: Cleanup and Optimization

**15. Remove old dual-store pattern**
- Keep `iteration_metadata` for fast queries
- Remove `iterations` full store (events now separate)
- Or keep for backward compatibility during transition

**16. Add event-level query methods**
- File: `ui/src/lib/persistence/EventDatabase.ts`
- Add `queryEventsAcrossIterations(filter)` for future analytics
- Add `getEventsForWorkspace(workspaceId)` for workspace queries
- Add `getEventsForTask(taskId)` via iteration join

**17. Update tests**
- Update EventDatabase tests for new schema
- Test migration from v2 to v3
- Test event persistence and retrieval
- Test iteration loading with separate events

### Phase 7: Documentation

**18. Update CLAUDE.md**
- Document new data model
- Explain migration process
- Update architecture diagrams

---

## Critical Files to Modify

**Schema & Types:**
- `ui/src/lib/persistence/types.ts` - Add types, update schema version
- `ui/src/lib/persistence/EventDatabase.ts` - Add stores, indexes, methods

**Persistence Hooks:**
- `ui/src/hooks/useIterationPersistence.ts` - Update to metadata-only saves
- `ui/src/hooks/useEventPersistence.ts` - New hook for event saves

**Server:**
- `ui/server/WorkspaceContext.ts` - Add workspaceId tracking
- `ui/server/index.ts` - Update WebSocket broadcasts

**UI Components:**
- `ui/src/hooks/useIterations.ts` - Update loading pattern
- `ui/src/components/history/EventLogViewer.tsx` - Handle separate event loading

**Tests:**
- `ui/src/lib/persistence/EventDatabase.test.ts` - Update tests
- Add migration tests

---

## Verification Steps

After implementation:

1. **Schema migration works:**
   - Open dev tools → Application → IndexedDB
   - Verify `events` store exists
   - Verify existing iterations migrated successfully
   - Check `workspaceId` field added to iterations

2. **Events are saved:**
   - Start an iteration
   - Verify events appear in `events` store as they arrive
   - Verify `by-iteration` index works

3. **Iterations load correctly:**
   - Open iteration history panel
   - Click on an iteration
   - Verify events load and display correctly

4. **Performance improvement:**
   - Monitor IndexedDB writes during iteration
   - Confirm no full array rewrites
   - Verify append-only pattern

5. **Workspace association works:**
   - Switch workspaces
   - Verify new iterations get correct `workspaceId`
   - Query iterations by workspace
