# Data Layer Refactoring Recommendations

## Problem Statement

Components throughout the UI mix data access with presentation, making them difficult to test in Storybook and creating tight coupling to the store.

## Current State

### Data Access Patterns Found

| Pattern | Count | Example |
|---------|-------|---------|
| Direct store access in component | 15+ | `Header`, `StatusBar`, `EventStream` |
| API calls in component | 8+ | `TaskDetailsDialog`, `TaskChatPanel` |
| Purely presentational (props only) | 12+ | `ChatInput`, `EventList`, `TaskList` |
| Data via custom hook | 5+ | `TasksSidebarPanel` uses `useTasks()` |

### Storybook Workarounds

Stories use these hacks to work around data-accessing components:

1. **Store Setter Components** - Inject data into store before rendering
2. **`withStoreState` decorator** - Global store initialization
3. **Wrapper Components** - Duplicate component logic with local state
4. **Fake API delays** - `setTimeout` to simulate async

### Components Needing Refactoring

**High Priority** (complex, frequently tested):
- `TaskChatPanel` - reads messages from store, makes API calls
- `EventStream` - reads events from store, uses multiple selectors
- `TaskDetailsDialog` - heavy store access + API calls
- `Header` - reads workspace/branch from store

**Medium Priority**:
- `StatusBar` - reads status from store
- `TaskSidebar` - needs store state
- `TaskChatHistoryDropdown` - fetches sessions directly
- `InstanceSelector` - reads instances from store

**Already Good** (no changes needed):
- `ChatInput`, `EventList`, `TaskList`, `TaskCard`
- UI primitives (`Button`, `Input`, `Dialog`, etc.)

## Recommended Architecture

### Container/Presentational Pattern

```
┌─────────────────────────────────────────┐
│  Container (data access)                │
│  - Uses hooks/store                     │
│  - Makes API calls                      │
│  - Passes data as props to child        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Presentational (pure)                  │
│  - Receives all data via props          │
│  - No store access                      │
│  - No API calls                         │
│  - Easy to test in Storybook            │
└─────────────────────────────────────────┘
```

### Naming Convention

- `FooController` → Container (data access, store/API calls)
- `Foo` → Presentational (props only, testable in Storybook)

Example:
- `TaskChatController` → renders `TaskChat`
- `EventStreamController` → renders `EventStream`
- `HeaderController` → renders `Header`

### File Structure

Containers live alongside their presentational components in the same directory:

```
components/
  chat/
    TaskChatController.tsx   # Container - uses hooks, passes props
    TaskChat.tsx             # Presentational - receives props
    ChatInput.tsx            # Presentational - already pure
```

### Hook Organization

Hooks organized by **data domain** (not by component):

```
hooks/
  useTaskChat.ts      # Task chat messages, send/receive
  useEvents.ts        # Event stream, iteration navigation
  useTaskDetails.ts   # Single task CRUD operations
  useWorkspace.ts     # Workspace info (already exists)
```

Each hook:
- Encapsulates store access
- Handles API calls
- Returns data + actions
- Can be mocked in tests

### Controller Scope

Only **5-8 controllers** at natural layout boundaries, not one per component:

```
App (root orchestrator - stays as-is)
├── HeaderController        → Header, InstanceSelector, WorkspaceSwitcher
├── TasksSidebarController  → TaskList, TaskCard, QuickTaskInput
├── EventStreamController   → EventList, IterationNav, ToolUseCard
├── TaskChatController      → TaskChat, ChatInput, TaskChatHistory
├── TaskDetailsController   → TaskDetails (refactored from TaskDetailsDialog)
└── StatusBarController     → StatusBar, TokenUsage
```

Prop drilling is fine for 1-2 levels within each region.

## Implementation Approach

### Option A: Incremental Refactoring

Refactor one component at a time:

1. Create presentational version alongside existing component
2. Update stories to use presentational version
3. Create container that wraps presentational version
4. Replace usages of old component with container
5. Delete old component

**Pros:** Low risk, can ship incrementally
**Cons:** Slower, temporary code duplication

### Option B: Big Bang Refactoring

Refactor all problematic components at once:

1. Define new hook structure
2. Create all presentational components
3. Create all containers
4. Update all imports
5. Update all stories

**Pros:** Consistent result, no intermediate states
**Cons:** Higher risk, larger PR

### Recommendation: Option A (Incremental)

Start with `TaskChatPanel` as proof of concept since it's actively being worked on.

## Specific Refactoring Examples

### TaskChatPanel → TaskChat + TaskChatController

**Before:**
```typescript
// TaskChatPanel.tsx (mixed)
export function TaskChatPanel() {
  const messages = useAppStore(selectTaskChatMessages)
  const isLoading = useAppStore(selectTaskChatLoading)

  const handleSend = async (text: string) => {
    await sendTaskChatMessage(text)  // API call
  }

  return <div>...</div>
}
```

**After:**
```typescript
// TaskChat.tsx (presentational)
export function TaskChat({ messages, isLoading, onSend }: Props) {
  return <div>...</div>
}

// TaskChatController.tsx (container)
export function TaskChatController() {
  const { messages, isLoading, sendMessage } = useTaskChat()
  return <TaskChat messages={messages} isLoading={isLoading} onSend={sendMessage} />
}

// useTaskChat.ts (hook)
export function useTaskChat() {
  const messages = useAppStore(selectTaskChatMessages)
  const isLoading = useAppStore(selectTaskChatLoading)

  const sendMessage = async (text: string) => {
    await sendTaskChatMessage(text)
  }

  return { messages, isLoading, sendMessage }
}
```

### Header → Header + HeaderController

**Before:**
```typescript
// Header.tsx (mixed)
export function Header() {
  const workspace = useAppStore(state => state.workspace)
  const branch = useAppStore(state => state.branch)
  return <header>...</header>
}
```

**After:**
```typescript
// Header.tsx (presentational)
export function Header({ workspace, branch }: Props) {
  return <header>...</header>
}

// HeaderController.tsx (container)
export function HeaderController() {
  const workspace = useAppStore(state => state.workspace)
  const branch = useAppStore(state => state.branch)
  return <Header workspace={workspace} branch={branch} />
}
```

## Testing Strategy

### Storybook Stories

With presentational components:
```typescript
// Header.stories.tsx
export const Default: Story = {
  args: {
    workspace: '/path/to/project',
    branch: 'main',
  }
}

export const LongPath: Story = {
  args: {
    workspace: '/very/long/path/to/deeply/nested/project',
    branch: 'feature/some-long-branch-name',
  }
}
```

No more `StoreSetter` hacks or `withStoreState` decorators needed.

### Unit Tests

Presentational components can be tested with React Testing Library without store setup:
```typescript
test('renders workspace name', () => {
  render(<Header workspace="/my/project" branch="main" />)
  expect(screen.getByText('/my/project')).toBeInTheDocument()
})
```

## Migration Priority

1. **Phase 1:** `TaskChatPanel`, `TaskDetailsDialog` (proof of concept + messy component)
2. **Phase 2:** `EventStream`, `Header`, `StatusBar` (most impactful)
3. **Phase 3:** `TaskSidebar`, `InstanceSelector` (remaining containers)
4. **Phase 4:** Cleanup remaining components

## Decisions

1. **File structure:** Controllers live alongside presentational components in the same directory
2. **Hook organization:** By domain (`useTaskChat`, `useEvents`) not by component
3. **Naming:** `FooController` for containers, `Foo` for presentational
4. **Exceptions:** `App.tsx` stays as root orchestrator (no `AppController`)
5. **Scope:** 5-8 controllers at layout boundaries, prop drilling within regions
