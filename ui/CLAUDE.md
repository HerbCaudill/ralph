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

## Iteration Event Logs

Ralph UI persists iteration event logs to IndexedDB for later review. This section documents how the feature works.

### Architecture

The event log system consists of:

1. **`eventDatabase`** (`src/lib/persistence/EventDatabase.ts`) - IndexedDB wrapper for storing event logs
2. **`saveEventLogAndAddComment`** (`src/lib/saveEventLogAndAddComment.ts`) - Saves event logs when tasks close and adds a comment with a link
3. **`useEventLogs`** (`src/hooks/useEventLogs.ts`) - Hook to query event logs from IndexedDB
4. **`useEventLogRouter`** (`src/hooks/useEventLogRouter.ts`) - URL hash routing for `#eventlog={id}` links

### Key Components

- **IterationHistoryPanel** - Full history browser with search/filter, opened from status bar "History" button
- **IterationLinks** - Shows saved iterations in task details dialog
- **EventLogLink** - Renders `#eventlog=abcd1234` references as clickable links in comments

### Event Log Flow

1. User closes a task (or task completes)
2. `saveEventLogAndAddComment()` is called with current events
3. Events are saved to IndexedDB with a unique ID
4. A closing comment is added to the task: `Closed. Event log: #eventlog=abcd1234`
5. The `EventLogLink` component renders these as clickable links
6. Clicking navigates via URL hash, which `useEventLogRouter` handles by fetching from IndexedDB

### Data Model

```typescript
interface PersistedEventLog {
  id: string // 8-char hex ID (e.g., "abcd1234")
  taskId: string | null // Associated task ID
  taskTitle: string | null
  source: string // How it was created (e.g., "task-close")
  workspacePath: string | null
  createdAt: number // Timestamp
  eventCount: number
  events: ChatEvent[] // Full event stream
}
```

## Code Style

- Use TypeScript for all code
- Use functional components with hooks
- Export types alongside components
- Document public interfaces with JSDoc comments
- Use `@/` path alias for imports within src/
