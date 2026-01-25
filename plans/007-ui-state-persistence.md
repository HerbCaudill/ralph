# Plan: Snapshot UI State to localStorage for Instant Loading

## Overview

Currently, the Ralph UI persists minimal state (panel widths, filters) to localStorage manually, while large data (events, chat) is persisted to IndexedDB via hooks. The app loads in stages:
1. Initial render with defaults
2. IndexedDB data loads asynchronously
3. Server data arrives via WebSocket

This plan adds comprehensive UI state persistence using Zustand's `persist` middleware so the app instantly restores to its exact last state on reload.

## Current State Persistence

**localStorage (manual):**
- `sidebarWidth`, `taskChatWidth`, `taskChatOpen`, `showToolOutput`
- `activeInstanceId`, `closedTimeFilter`

**IndexedDB (via hooks):**
- Event logs (large)
- Task chat sessions (large)

**Not persisted:**
- UI view state (`viewingIterationIndex`, `taskSearchQuery`, `selectedTaskId`)
- Workspace metadata (`workspace`, `branch`, `issuePrefix`)
- Theme preference
- Instances Map structure

## Design Decisions

### What to Persist in localStorage

**YES (instant restoration):**
- All UI preferences: `sidebarWidth`, `taskChatWidth`, `taskChatOpen`, `showToolOutput`, `sidebarOpen`
- View state: `viewingIterationIndex`, `taskSearchQuery`, `selectedTaskId`, `isSearchVisible`
- Workspace metadata: `workspace`, `branch`, `issuePrefix`, `accentColor`, `theme`, `closedTimeFilter`
- Multi-instance: `activeInstanceId`, instance metadata + current events for active instance
- **Tasks array**: Small (~25KB), enables instant task list display
- **Active instance events**: Current iteration only (~100KB), enables instant event stream display

**NO (too large or transient):**
- All instances' full event history - Keep in IndexedDB (too large)
- `tokenUsage`, `contextWindow`, `iteration` - Runtime metrics, rebuilt on load
- `ralphStatus`, `connectionStatus` - Transient state
- Loading flags, dialog states - Not meaningful after reload
- Task chat messages/events - Keep in IndexedDB (large)

### Instances Map Serialization

The `instances` Map needs special handling:
- **Store**: Serialize to `{ id: string, metadata: {...} }[]` array
- **Load**: Deserialize back to `Map<string, RalphInstance>` with clean instances
- Instance runtime state (events, token usage, etc.) will be rebuilt via IndexedDB hooks + server hydration

## Implementation Plan

### 1. Install Zustand persist middleware

**File:** `ui/package.json`
- The persist middleware is already part of `zustand` - no new dependency needed

### 2. Create storage configuration

**File:** `ui/src/store/persist.ts` (new file)
- Define `persistConfig` with:
  - `name: 'ralph-ui-state'` - Storage key
  - `version: 1` - For future migrations
  - `storage: createJSONStorage(() => localStorage)`
  - `partialize` function to whitelist persisted state
  - `onRehydrateStorage` callback for logging/debugging

**Partialize logic:**
```typescript
partialize: (state) => ({
  // UI preferences
  sidebarWidth: state.sidebarWidth,
  sidebarOpen: state.sidebarOpen,
  taskChatWidth: state.taskChatWidth,
  taskChatOpen: state.taskChatOpen,
  showToolOutput: state.showToolOutput,
  closedTimeFilter: state.closedTimeFilter,
  theme: state.theme,

  // View state
  viewingIterationIndex: state.viewingIterationIndex,
  taskSearchQuery: state.taskSearchQuery,
  selectedTaskId: state.selectedTaskId,
  visibleTaskIds: state.visibleTaskIds,

  // Workspace metadata
  workspace: state.workspace,
  branch: state.branch,
  issuePrefix: state.issuePrefix,
  accentColor: state.accentColor,

  // Tasks and events (small enough for instant display)
  tasks: state.tasks,

  // Multi-instance
  activeInstanceId: state.activeInstanceId,
  instances: serializeInstances(state.instances, state.activeInstanceId),
})
```

**Serialization helpers:**
```typescript
function serializeInstances(
  instances: Map<string, RalphInstance>,
  activeInstanceId: string
) {
  const array = []
  for (const [id, instance] of instances) {
    // Only persist events for the active instance (to keep size reasonable)
    const instanceData = {
      id,
      name: instance.name,
      agentName: instance.agentName,
      worktreePath: instance.worktreePath,
      branch: instance.branch,
      createdAt: instance.createdAt,
      // Persist events only for active instance
      events: id === activeInstanceId ? instance.events : [],
    }
    array.push(instanceData)
  }
  return array
}

function deserializeInstances(array: any[]): Map<string, RalphInstance> {
  const map = new Map()
  for (const item of array) {
    const instance = createRalphInstance(
      item.id,
      item.name,
      item.agentName,
    )
    // Restore events if they were persisted
    if (item.events && Array.isArray(item.events)) {
      instance.events = item.events
    }
    map.set(item.id, instance)
  }
  return map
}
```

### 3. Apply persist middleware to store

**File:** `ui/src/store/index.ts`
- Wrap the store with `persist()` middleware
- Remove manual localStorage code for persisted fields
- Update `getInitialStateWithPersistence()` to rely on persist middleware

**Before:**
```typescript
export const useAppStore = create<AppState & AppActions>(set => ({
  ...getInitialStateWithPersistence(),
  // actions...
}))
```

**After:**
```typescript
export const useAppStore = create<AppState & AppActions>()(
  persist(
    set => ({
      ...initialState,
      // actions...
    }),
    persistConfig
  )
)
```

### 4. Remove manual localStorage functions

**File:** `ui/src/store/index.ts`
- Delete: `loadSidebarWidth`, `saveSidebarWidth`, `loadTaskChatWidth`, `saveTaskChatWidth`, etc.
- Delete: All `STORAGE_KEY` constants (handled by persist middleware)
- Delete: All `try-catch` wrapper functions
- Simplify: Setter actions no longer call `saveX()` functions

### 5. Update store initialization

**File:** `ui/src/store/index.ts`
- Remove `getInitialStateWithPersistence()` function
- Use `initialState` directly in the store
- The persist middleware will handle rehydration automatically

### 6. Handle instance metadata sync

**File:** `ui/src/store/index.ts`, action: `hydrateInstances`
- Update to preserve instance metadata from localStorage
- Merge server data with persisted instance metadata
- Only create new instances if they don't exist in persisted state

### 7. Test state restoration

**Verification steps:**
1. Open app, set various UI state (sidebar width, viewing iteration, search query, etc.)
2. Reload page - verify state restores instantly (no flash of default state)
3. Inspect `localStorage['ralph-ui-state']` - verify persisted data structure
4. Test with multiple instances - verify active instance restores correctly
5. Test workspace switching - verify workspace metadata persists
6. Clear localStorage and reload - verify clean initialization with defaults

## Critical Files

- `ui/src/store/index.ts` - Main store implementation (~1800 lines)
- `ui/src/store/persist.ts` - New file for persist configuration (~100 lines)
- `ui/src/hooks/useStoreHydration.ts` - Verify IndexedDB hydration still works (~50 lines)

## Edge Cases & Considerations

1. **Migration from old localStorage keys:**
   - Old keys (`ralph-ui-sidebar-width`, etc.) will be orphaned
   - Users will lose preferences on first load after update
   - Consider one-time migration: read old keys, populate store, delete old keys

2. **localStorage size limits:**
   - Persisted state: ~135KB (UI: 5KB, Tasks: 25KB, Events: 100KB, Instances: 5KB)
   - Well under typical 5-10MB localStorage limits
   - Only active instance's events are persisted (not all instances)
   - If size becomes an issue, can limit events to last N or drop `visibleTaskIds`

3. **Stale workspace data:**
   - `workspace`, `branch`, `issuePrefix` might be stale if user switches workspaces outside the app
   - Server WebSocket will overwrite with fresh data on connect
   - This is acceptable - brief flash of old workspace name is better than empty state

4. **Instance hydration race:**
   - localStorage restores instances immediately
   - WebSocket `hydrateInstances()` arrives later with server truth
   - Solution: Merge strategy - preserve runtime state, update metadata from server

5. **Backward compatibility:**
   - Legacy flat fields (`ralphStatus`, `events`, etc.) still exist for backward compat
   - These will be empty on initial load, then populated by WebSocket/IndexedDB
   - No changes needed to existing code consuming flat fields

## Verification

**Manual testing:**
1. Set sidebar width to 450px, task chat width to 650px
2. Search for "test", select a task, view iteration 3
3. Switch to "past_week" closed filter
4. Reload page - verify ALL state restores instantly:
   - Sidebar width: 450px ✓
   - Task chat width: 650px ✓
   - Search query: "test" ✓
   - Selected task: preserved ✓
   - Viewing iteration: 3 ✓
   - Closed filter: "past_week" ✓

**localStorage inspection:**
```bash
# In browser console:
JSON.parse(localStorage['ralph-ui-state'])
# Should show all persisted state fields
```

**IndexedDB verification:**
```bash
# In browser DevTools > Application > IndexedDB > ralph-ui
# Verify event logs and chat sessions still persist independently
```

## Benefits

1. **Instant restoration** - App shows exact last state immediately, no loading flash
2. **Instant task list** - Tasks display immediately instead of waiting for API
3. **Instant event stream** - Current iteration's events show immediately (no IndexedDB wait)
4. **Better UX** - Users don't lose their place when refreshing
5. **Cleaner code** - Single persist configuration vs scattered localStorage calls (~150 lines removed)
6. **Type-safe** - Zustand persist handles serialization, no manual string conversion
7. **Versioned** - Built-in migration support for future schema changes

## Risks & Mitigations

**Risk:** State rehydration fails (corrupted localStorage)
- **Mitigation:** Persist middleware catches errors, falls back to defaults

**Risk:** Stale state after code updates (schema changes)
- **Mitigation:** Version field in config enables migrations

**Risk:** Instances Map deserialization issues
- **Mitigation:** Thorough testing of serialize/deserialize helpers

**Risk:** Users lose preferences on migration
- **Mitigation:** Optional: One-time migration reads old keys before deleting
