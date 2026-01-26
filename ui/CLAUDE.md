# Ralph UI - Development Guide

This document contains project conventions and guidelines for AI assistants working on this codebase.

## Architecture Overview

Ralph UI uses a **controller/presentational pattern** to separate concerns:

- **Presentational components**: Pure components that receive all data via props
- **Controller components**: Thin wrappers that connect presentational components to hooks
- **Domain hooks**: Encapsulate store access, API calls, and business logic

## Controller/Presentational Pattern

### Naming Convention

- **FooController** - Controller component that connects hooks to presentational component
- **Foo** - Presentational component that receives all data via props

Example:

```
TaskChatController.tsx  → Controller (connects useTaskChat to TaskChat)
TaskChat.tsx            → Presentational (pure component, all props)
```

### File Structure

Controllers live alongside their presentational components:

```
src/components/chat/
├── TaskChat.tsx              # Presentational component
├── TaskChat.stories.tsx      # Storybook stories (test presentational)
├── TaskChat.test.tsx         # Unit tests
├── TaskChatController.tsx    # Controller component
└── ...
```

### Hook Organization

Hooks are organized by **domain**, not by component:

```
src/hooks/
├── useTaskChat.ts            # Task chat domain logic
├── useTaskDetails.ts         # Task details domain logic
├── useEventStream.ts         # Event streaming domain logic
├── useTheme.ts               # Theme management
├── useWorkspaces.ts          # Workspace management
└── ...
```

### When to Use Controllers vs Presentational Components

**Use a controller when:**

- Component needs store access (Zustand)
- Component makes API calls
- Component has complex state management
- Component needs to coordinate multiple pieces of data

**Use presentational component directly when:**

- All data can be passed via props from parent
- Component is purely visual (buttons, cards, layouts)
- Component is used in Storybook stories

### Pattern Implementation

**Controller component:**

```typescript
export function TaskChatController({ className, onClose }: TaskChatControllerProps) {
  // 1. Call the domain hook
  const {
    events,
    isLoading,
    sendMessage,
    // ... other state and actions
  } = useTaskChat()

  // 2. Pass everything to presentational component
  return (
    <TaskChat
      className={className}
      events={events}
      isLoading={isLoading}
      onSendMessage={sendMessage}
      onClose={onClose}
    />
  )
}
```

**Presentational component:**

```typescript
/**
 * Presentational component for task chat.
 *
 * This is a pure component that receives all data via props.
 * Business logic and store access are handled by the parent controller.
 */
export function TaskChat({
  events,
  isLoading,
  onSendMessage,
  onClose,
}: TaskChatProps) {
  // Rendering logic only - no store access, no API calls
  return (
    <div>
      {/* ... */}
    </div>
  )
}
```

**Domain hook:**

```typescript
/**
 * Hook for managing task chat state and actions.
 *
 * Encapsulates store access and API calls for the task chat feature.
 * This is the data access layer for TaskChatController.
 */
export function useTaskChat(): UseTaskChatResult {
  // Store selectors
  const messages = useAppStore(selectTaskChatMessages)
  const isLoading = useAppStore(selectTaskChatLoading)

  // Store actions
  const addMessage = useAppStore(state => state.addTaskChatMessage)

  // Business logic, computed values, etc.
  const sendMessage = useCallback(async (message: string) => {
    // ...
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    // ...
  }
}
```

### Storybook Testing Approach

**Stories test the presentational component directly**, not the controller:

```typescript
// TaskChat.stories.tsx
import { TaskChat } from "./TaskChat"

const meta: Meta<typeof TaskChat> = {
  title: "Panels/TaskChat",
  component: TaskChat, // Test presentational component
  args: {
    events: [],
    isLoading: false,
    onSendMessage: fn(),
    // All props are explicit - no store mocking needed
  },
}
```

This approach provides:

- **Isolation**: Stories don't depend on store state
- **Control**: Easy to test all visual states with explicit props
- **Speed**: No need for complex store setup in stories
- **Documentation**: Props interface is clear and explicit

### Benefits of This Pattern

1. **Testability**: Presentational components are easy to test in Storybook
2. **Reusability**: Presentational components can be used with different data sources
3. **Maintainability**: Clear separation between UI and data logic
4. **Documentation**: Storybook stories serve as visual documentation

## Testing

### Test File Naming

- `Foo.test.tsx` - Unit tests for component
- `Foo.stories.tsx` - Storybook stories with interaction tests

### Running Tests

```bash
pnpm test:all      # Run all tests (TypeScript check + Vitest + Playwright)
pnpm test          # Run unit tests only
pnpm test:watch    # Run unit tests in watch mode
pnpm test:pw       # Run Playwright e2e tests
```

## Data Model

Ralph UI uses IndexedDB for client-side persistence of sessions, events, and related data. This section documents the normalized schema (v3) and persistence architecture.

### IndexedDB Schema Overview (v3)

The database uses eight object stores:

| Store                | Purpose                                           | Key Indexes                                                                                            |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `session_metadata`   | Session metadata for fast listing                 | `by-instance`, `by-started-at`, `by-instance-and-started-at`, `by-task`, `by-workspace-and-started-at` |
| `sessions`           | Full session data (metadata only in v3+)          | Primary key: `id`                                                                                      |
| `events`             | Individual events (normalized from sessions)      | `by-session`, `by-timestamp`                                                                           |
| `task_chat_metadata` | Task chat metadata for fast listing               | Primary key: `id`                                                                                      |
| `task_chat_sessions` | Full task chat data including messages and events | Primary key: `id`                                                                                      |
| `event_log_metadata` | Standalone event log metadata                     | Primary key: `id`                                                                                      |
| `event_logs`         | Standalone event log data                         | Primary key: `id`                                                                                      |
| `sync_state`         | Key-value settings and sync state                 | Primary key: `key`                                                                                     |

### Schema Evolution

**Version 1** - Initial schema:

- `session_metadata`, `sessions`, `task_chat_metadata`, `task_chat_sessions`, `sync_state`
- Sessions stored events inline in an `events` array

**Version 2** - Added event logs:

- Added `event_log_metadata` and `event_logs` stores
- Standalone event logs for saved/exported sessions

**Version 3** - Normalized events:

- Added `events` store for normalized event storage
- Added `by-workspace-and-started-at` index to `session_metadata`
- Events extracted from sessions into separate records

### v2 to v3 Migration

The migration runs automatically on database upgrade:

1. **Extract events** - Events are read from each session's embedded `events` array
2. **Create event records** - Individual `PersistedEvent` records are written to the `events` store
3. **Update sessions** - The `events` array is removed from session records
4. **Handle legacy data** - `workspaceId` is set to `null` for sessions that predate workspace support
5. **Idempotent** - Sessions already migrated (no `events` array) are skipped

### Persistence Architecture (v3+)

Session persistence uses a two-hook approach:

**`useSessionPersistence`** - Persists session metadata only:

- Saves on session boundaries (start, turn completion)
- Saves on session completion
- Writes to `session_metadata` and `sessions` stores

**`useEventPersistence`** - Persists individual events as they arrive:

- Append-only writes to `events` store
- Each event is written immediately when received
- No full array rewrites required

**Benefits of normalized schema:**

- Efficient append-only writes (no array mutations)
- Event-level queries across sessions
- Cross-workspace analytics via `workspaceId` index
- ~44 bytes overhead per event vs nested approach

### Loading Sessions

Sessions are loaded using a join pattern:

```typescript
import { eventDatabase } from "@/lib/persistence"

// 1. Load session metadata (fast)
const session = await eventDatabase.getSession(sessionId)

// 2. Fetch events separately when needed
const persistedEvents = await eventDatabase.getEventsForSession(sessionId)
// Events are sorted by timestamp ascending
// Extract ChatEvent from each PersistedEvent
const events = persistedEvents.map(pe => pe.event)
```

### Key Types

Types are defined in `src/lib/persistence/types.ts`:

```typescript
/** Session metadata (events stored separately in v3+) */
interface PersistedSession extends SessionMetadata {
  /**
   * @deprecated In v3+, events are stored in the separate events table.
   * This field exists for backward compatibility with v2 data.
   */
  events?: ChatEvent[]
}

/** Individual event with session reference */
interface PersistedEvent {
  id: string // e.g., "session-123-event-0"
  sessionId: string // Reference to parent session
  timestamp: number // Event timestamp
  eventType: string // e.g., "user", "assistant", "tool_use"
  event: ChatEvent // Full event data
}

/** Current schema version */
const PERSISTENCE_SCHEMA_VERSION = 3
```

## Session Event Logs

Ralph UI saves standalone event logs to IndexedDB when sessions complete. These are separate from the real-time `events` store - event logs are snapshots saved from completed sessions for later review.

### Architecture

The event log system consists of:

1. **`eventDatabase`** (`src/lib/persistence/EventDatabase.ts`) - IndexedDB wrapper for storing event logs
2. **`saveEventLogAndAddComment`** (`src/lib/saveEventLogAndAddComment.ts`) - Saves event logs when tasks close and adds a comment with a link
3. **`useEventLogs`** (`src/hooks/useEventLogs.ts`) - Hook to query event logs from IndexedDB
4. **`useEventLogRouter`** (`src/hooks/useEventLogRouter.ts`) - URL hash routing for `#eventlog={id}` links

### Key Components

- **SessionHistoryPanel** - Full history browser with search/filter, opened from status bar "History" button
- **SessionLinks** - Shows saved sessions in task details dialog
- **EventLogLink** - Renders `#eventlog=abcd1234` references as clickable links in comments

### Event Log Flow

1. User closes a task (or task completes)
2. `saveEventLogAndAddComment()` is called with current events
3. Events are saved to IndexedDB with a unique ID
4. A closing comment is added to the task: `Closed. Event log: #eventlog=abcd1234`
5. The `EventLogLink` component renders these as clickable links
6. Clicking navigates via URL hash, which `useEventLogRouter` handles by fetching from IndexedDB

### Event Log Data Model

Event logs are stored in `event_log_metadata` and `event_logs` stores (separate from the `events` store used for real-time persistence):

```typescript
interface PersistedEventLog {
  id: string // 8-char hex ID (e.g., "abcd1234")
  taskId: string | null // Associated task ID
  taskTitle: string | null
  source: string // How it was created (e.g., "task-close")
  workspacePath: string | null
  createdAt: number // Timestamp
  eventCount: number
  events: ChatEvent[] // Full event stream snapshot
}
```

## Server WebSocket Events

The server broadcasts events to connected clients via WebSocket. All broadcast messages include:

- `type` - Event type (e.g., `ralph:event`, `ralph:status`, `instance:created`)
- `instanceId` - The Ralph instance ID
- `workspaceId` - Workspace ID for cross-workspace event correlation (null for main workspace)
- `timestamp` - Event timestamp

### workspaceId Field

The `workspaceId` field is included in:

- All WebSocket broadcast messages (`ralph:event`, `ralph:status`, `ralph:output`, `ralph:error`, `ralph:exit`, `instance:created`, `task-chat:*`, `mutation:event`)
- API responses from `GET /api/instances` and `POST /api/instances`
- `RalphInstanceState` and `CreateInstanceOptions` interfaces in `server/RalphRegistry.ts`

This enables:

- Cross-workspace event correlation
- Client-side persistence to track which workspace events belong to
- Future multi-workspace analytics support

## Code Style

- Use TypeScript for all code
- Use functional components with hooks
- Export types alongside components
- Document public interfaces with JSDoc comments
- Use `@/` path alias for imports within src/
