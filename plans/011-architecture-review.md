# 011: Architecture Review

## Summary

Follow-up to `plans/010-architecture-review.md`. Identifies architectural anti-patterns across state management, WebSocket connection handling, workspace isolation, and event processing.

## Issues Found

### Critical

#### C1. Timestamp equality bug causes event loss on reconnect
- **File:** `ui/server/index.ts:1619,1650`
- **Pattern:** `event.timestamp > arLastTs` uses strict `>`, dropping events with equal timestamps
- **Impact:** Events sharing a millisecond timestamp are lost on reconnect
- **Fix:** Change to `>=` and add client-side dedup by event UUID

#### C2. Broadcast sends to ALL clients without workspace filter
- **File:** `ui/server/index.ts:1812-1819`
- **Pattern:** `broadcast()` iterates all connected clients regardless of workspace
- **Impact:** Events from workspace A leak to clients viewing workspace B
- **Fix:** Tag WebSocket clients with workspace ID, filter on broadcast

#### C3. Session ID generation mismatch between ralphConnection and store
- **Files:** `ralphConnection.ts:104` → `${instanceId}-${startedAt}`, `store/index.ts:431` → `session-${timestamp}`
- **Impact:** Same session referenced by two different IDs; events persisted under one, metadata under another
- **Fix:** Unify to a single session ID generation function in shared code

### High

#### H1. Workspace switch race condition
- **File:** `ui/src/hooks/useWorkspaces.ts:54-89`
- **Pattern:** `clearWorkspaceData()` + `clearEventTimestamps()` are synchronous, but WebSocket messages can arrive between clear and re-setup
- **Impact:** Stale timestamps, events routed to cleared instance
- **Fix:** Pause WebSocket processing during workspace switch, or queue incoming messages

#### H2. Task chat events hardcoded to "default" instance
- **File:** `ui/server/WorkspaceContext.ts:437`
- **Pattern:** `persistTaskChatEvent` always uses `"default"` as instance ID
- **Impact:** Cross-workspace task chat event leakage on reconnect
- **Fix:** Use actual instance ID or workspace-scoped key

#### H3. Task chat pending events lost for non-active instances
- **File:** `ui/src/lib/ralphConnection.ts:365-383`
- **Pattern:** Timestamp updated for all instances, but events only added to store for active instance
- **Impact:** Switching instances loses task chat history permanently (timestamp marks them as "seen")
- **Fix:** Buffer non-active events, or don't advance timestamp for non-active instances

#### H4. Dual legacy/unified reconnect paths with no mutual exclusion
- **Files:** `ralphConnection.ts:297-456`, `server/index.ts:1591-1743`
- **Pattern:** Both old and new handlers update `lastEventTimestamps` map independently
- **Impact:** Double-processing of reconnect responses, timestamp corruption
- **Fix:** Remove legacy handlers (breaking change) or add dedup guard

#### H5. Dual-broadcast sends every event twice to all clients
- **File:** `ui/server/index.ts:1911-1926`
- **Pattern:** Broadcast unified envelope AND legacy format for every event
- **Impact:** Client must deduplicate; no consistent event ID across formats
- **Fix:** Add client capability negotiation, or remove legacy broadcast

### Medium

#### M1. Module-level singleton state without synchronization
- **File:** `ui/src/lib/ralphConnection.ts:36-83`
- **Pattern:** `lastEventTimestamps` and `currentSessions` modified by WebSocket handler, workspace switch, and hydration concurrently
- **Fix:** Centralize mutations through a single queue/dispatcher

#### M2. useSessionPersistence silently skips on race
- **File:** `ui/src/hooks/useSessionPersistence.ts:320-340`
- **Pattern:** If `getCurrentSession()` returns null (boundary event not yet processed), session metadata is skipped entirely
- **Fix:** Retry or queue persistence until session ID available

#### M3. clearWorkspaceData clears ALL instances
- **File:** `ui/src/store/index.ts:893-935`
- **Pattern:** Clears events for every instance, not just active workspace's instances
- **Fix:** Scope clearing to instances belonging to the outgoing workspace

#### M4. EventDatabase queries don't enforce workspace isolation
- **File:** `ui/src/lib/persistence/EventDatabase.ts:275-283`
- **Pattern:** `getLatestActiveSession(instanceId)` ignores workspace; could restore wrong workspace's session
- **Fix:** Add workspaceId parameter to session lookup

#### M5. Task chat batch may never flush after workspace switch
- **File:** `ui/src/store/index.ts:562-571`
- **Pattern:** `clearWorkspaceData` clears timeout but events added between clear and new timeout are lost
- **Fix:** Flush before clearing

#### M6. Non-atomic store updates on workspace_switched
- **File:** `ui/src/lib/ralphConnection.ts:462-483`
- **Pattern:** Status and events updated in separate Zustand calls; React may render between them
- **Fix:** Combine into a single `set()` call

#### M7. HMR state restoration incomplete
- **File:** `ui/src/lib/ralphConnection.ts:1227-1277`
- **Pattern:** Restores module state but doesn't verify WebSocket is still healthy
- **Fix:** Add readyState check after restoration, reconnect if needed

### Low

#### L1. Event mutation after creation
- **File:** `ui/server/RalphRegistry.ts:829-852`
- **Pattern:** UUID assigned to event object after creation via mutation
- **Fix:** Create new object with UUID rather than mutating

#### L2. Agent adapter leaks Claude-specific details
- **File:** `ui/server/AgentAdapter.ts:114-193`
- **Pattern:** Thinking tokens, retry config assumed by base class
- **Fix:** Move adapter-specific config to concrete classes

#### L3. Inconsistent event action semantics in store
- **File:** `ui/src/store/index.ts:758-847`
- **Pattern:** `setEvents()` merges (not replaces); `replaceEvents()` replaces—naming doesn't clarify
- **Fix:** Rename `setEvents` → `mergeEvents` or add JSDoc
