# Restore old UI features

## Goal

Restore functionality that existed in the old Ralph UI before the rearchitecture, pulling code from git history where possible.

## Current state

The rearchitected UI (`packages/ui/`) has:
- Three-panel layout using `react-resizable-panels`
- `TaskChatPanel` (placeholder, not connected)
- `TaskSidebarController` from beads-view
- `RalphRunner` with AgentView
- Basic StatusBar
- Minimal uiStore (sidebar/panel widths, tool output toggle)

## Missing functionality

### 1. Header with workspace selector

The old UI had a header with:
- Logo
- WorkspacePicker dropdown (workspace name, issue count, branch)
- Settings dropdown
- Help button

**Existing code to reuse:**
- `WorkspaceSelector` component exists in `@herbcaudill/beads-view`
- `useWorkspace` hook exists in beads-view
- Server endpoints exist: `/api/workspace`, `/api/workspaces`, `/api/workspace/switch`

### 2. Theme system

The old UI had:
- VS Code theme picker (discovers installed themes)
- Light/dark/system mode toggle
- Theme persistence per mode
- Theme auto-switching based on selection

**Needs restoration from git:**
- `ThemeDiscovery.ts` (server-side theme discovery)
- `ThemePicker.tsx` component
- `ThemeToggle.tsx` component
- `SettingsDropdown.tsx` component
- `useTheme` hook
- `useThemeCoordinator` hook
- `useVSCodeTheme` hook
- `/api/themes` endpoint

### 3. Peacock accent color integration

The old UI applied workspace accent colors from VS Code's Peacock extension:
- Read from `.vscode/settings.json`
- Applied as CSS custom property
- Visible in workspace selector and throughout UI

**Existing code:**
- Server already reads peacock color via `readPeacockColor()`
- `/api/workspace` returns `accentColor`
- `useWorkspace` hook receives `accentColor`

**Missing:** CSS variable injection and usage in components

### 4. Task chat functionality

The left panel should show a task-specific chat:
- Dedicated chat for discussing/managing tasks
- Uses `manage-tasks` system prompt
- Session picker for switching between chat sessions

**Reference implementation:** `packages/agent-demo/src/App.tsx` with `manage-tasks` system prompt

### 5. Store enhancements

Add to uiStore:
- `theme`: "system" | "light" | "dark"
- `vscodeThemeId`: current theme ID
- `lastDarkThemeId`, `lastLightThemeId`: restore per-mode
- `accentColor`: from workspace

### 6. Hotkeys and command palette

The old UI had comprehensive keyboard shortcuts:
- Agent control: Start, Stop, Pause, Resume
- Navigation: Previous/next session, previous/next task
- Focus management: Sidebar, main, search, chat, task detail
- Theme cycling
- Tool output visibility toggle
- Command palette
- Help/hotkeys dialog

**Reference implementation:** `@herbcaudill/beads-view` and `@herbcaudill/agent-view` have hotkey infrastructure

### 7. Task ID linking

The old UI auto-linked task IDs in text:
- Detect task IDs like `rui-123`
- Render as clickable links
- Cut the prefix for display (show `123` instead of `rui-123`)

### 8. Task detail panel wiring

The TaskDetailPanel component exists but isn't rendered in App.tsx. When a task is clicked, `openDialogById` is called but nothing displays. Need to wire it up so task details show when a task is selected.

**Reference:** `packages/beads-demo/src/App.tsx` - shows TaskDetailPanel in place of TaskChat when selectedTaskId is set.

### 9. Footer/status bar enhancements

The old UI footer had:
- Pause/resume/stop controls (ControlBar)
- Current task progress indicator
- Connection status indicator
- Token usage (input/output)
- Context window percentage
- Session timer/duration
- Workspace name and branch

**Existing code:**
- `AgentControls` component exists in agent-view
- `TokenUsageDisplay` and `ContextWindowProgress` exist in agent-view
- Current StatusBar has basic version but missing controls

**Reference:** `RalphLoopPanel.tsx` has some of this, but it's in the right panel not the global footer

## Out of scope (punted)

- Multi-instance support (instance selector, instance count badge)
- IndexedDB persistence (handled by agent/beads packages)
- Custom session history panel (use existing SessionPicker from agent-view)

## Tasks

### Phase 1: Header and workspace integration

1. Create Header component with logo, workspace selector, settings button
2. Wire up WorkspaceSelector from beads-view to App.tsx
3. Add accent color CSS variable injection

### Phase 2: Theme system

4. Restore ThemeDiscovery.ts to beads-server
5. Add /api/themes endpoint to beads-server
6. Restore ThemePicker component
7. Restore ThemeToggle component (light/dark/system)
8. Create SettingsDropdown with theme picker
9. Add theme-related state to uiStore
10. Restore useTheme and useThemeCoordinator hooks

### Phase 3: Task chat

11. Connect TaskChatPanel to agent-server using useAgentChat with manage-tasks prompt
12. Add SessionPicker for task chat sessions

### Phase 4: Hotkeys and command palette

13. Register hotkey handlers in App.tsx
14. Create HotkeysDialog component
15. Restore CommandPalette component
16. Wire up all hotkey actions

### Phase 5: Task ID linking

17. Restore TextWithLinks component for task ID auto-linking
18. Add prefix-cutting display logic

### Phase 6: Footer/status bar

19. Add agent controls (pause/resume/stop) to global footer
20. Add current task indicator to footer
21. Ensure token usage and context window are visible
22. Add session timer/duration display
23. Show workspace name and branch in footer

## Approach

For each task, first check git history at `7704f1f4^` to find the original implementation. Copy and adapt as needed, updating imports for the new package structure.

Key commits:
- `7704f1f4` - The rearchitecture commit (before this has the old code)
- `d4dab3a0` - Added react-resizable-panels
