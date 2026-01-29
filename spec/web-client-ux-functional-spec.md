# Web Client UX Functional Specification

**Product:** Ralph Web Client

**Scope:** This document specifies the complete user experience of the web client only. It intentionally excludes all implementation, architecture, data storage, or technical stack details. It is written to allow a separate agent to rebuild the user experience with high fidelity.

**Last updated:** 2026-01-29

## 1. Scope, principles, and definitions

### 1.1 In-scope
- All screens, panels, dialogs, and user-facing behaviors of the web client.
- Visual appearance (layout, typography, color usage, iconography, spacing, hierarchy).
- User interactions (mouse, keyboard, focus handling, navigation).
- UI state changes (loading, empty, error, success, disabled).
- Persistence of user preferences across reloads.

### 1.2 Out of scope
- Any architectural or implementation details (frameworks, modules, APIs, data stores, network protocols, file paths).
- Server/CLI behavior beyond what is visible to the user.

### 1.3 Domain definitions (user-facing)
- **Task**: A unit of work with title, status, type, priority, and optional hierarchy and relationships.
- **Session**: A contiguous run of the agent’s work, displayed as a timeline of events.
- **Event**: A single item in the session timeline (messages, tool uses, errors, lifecycle markers).
- **Task chat**: A dedicated chat thread for task-related assistance.

## 2. Screenshot index

All screenshots live in `spec/screenshots/`. Each referenced screenshot is required evidence for the section where it appears.

| # | Screenshot | Purpose |
|---|---|---|
| 01 | `01-app-main.png` | Full app layout with data |
| 02 | `02-header-default.png` | Header baseline |
| 03 | `03-header-multiple-instances.png` | Header with instance count badge |
| 04 | `04-workspace-picker.png` | Workspace picker closed |
| 05 | `05-workspace-picker-open.png` | Workspace picker open |
| 06 | `06-settings-dropdown.png` | Settings dropdown open |
| 07 | `07-command-palette.png` | Command palette |
| 08 | `08-hotkeys-dialog.png` | Hotkeys dialog |
| 09 | `09-status-bar.png` | Status bar |
| 10 | `10-control-bar.png` | Control bar |
| 11 | `11-task-sidebar.png` | Task sidebar |
| 12 | `12-task-list-default.png` | Task list default groups |
| 13 | `13-task-list-collapsed.png` | Task list collapsed groups |
| 14 | `14-task-card.png` | Task card styling |
| 15 | `15-quick-task-input.png` | Quick task input |
| 16 | `16-search-input.png` | Task search input |
| 17 | `17-task-details.png` | Task details panel |
| 18 | `18-related-tasks.png` | Related tasks section |
| 19 | `19-comments-section.png` | Comments section |
| 20 | `20-session-links.png` | Task session links |
| 21 | `21-event-stream-default.png` | Event stream with content |
| 22 | `22-event-stream-empty.png` | Event stream empty state |
| 23 | `23-event-stream-running.png` | Event stream running state |
| 24 | `24-event-stream-historical.png` | Event stream historical session |
| 25 | `25-tooluse-edit.png` | Tool use: Edit diff |
| 26 | `26-tooluse-bash.png` | Tool use: Bash output |
| 27 | `27-tooluse-todo.png` | Tool use: Todo update |
| 28 | `28-error-event.png` | Error event card |
| 29 | `29-task-lifecycle-event.png` | Task lifecycle event card |
| 30 | `30-promise-complete-event.png` | Session complete card |
| 31 | `31-user-message.png` | User message bubble |
| 32 | `32-assistant-text.png` | Assistant text with markdown |
| 33 | `33-session-history-dropdown.png` | Session history dropdown open |
| 34 | `34-task-chat-empty.png` | Task chat empty state |
| 35 | `35-task-chat-conversation.png` | Task chat with messages |
| 36 | `36-task-chat-error.png` | Task chat error state |
| 37 | `37-scroll-to-latest.png` | Scroll-to-latest button |
| 38 | `38-task-progress-bar.png` | Task progress bar |
| 39 | `39-context-window-progress.png` | Context window progress |
| 40 | `40-token-usage.png` | Token usage display |
| 41 | `41-header-notifications.png` | Header notifications (merge conflict, persistence error) |
| 42 | `42-header-disconnected.png` | Header with disconnected status |
| 43 | `43-theme-picker.png` | Theme picker list |
| 44 | `44-thinking-block.png` | Thinking block |

## 3. Visual language

### 3.1 Typography
- Primary sans-serif for UI (IBM Plex Sans) with clear hierarchy.
- Monospace used for IDs, commands, and technical snippets (IBM Plex Mono).
- Serif used for assistant prose/long-form responses (IBM Plex Serif).

### 3.2 Color and theming
- Supports Light, Dark, and System appearance modes.
- A workspace accent color tints key UI elements (header background, selection rings, progress bars).
- Status colors are semantically consistent across the app:
  - Success: green
  - Warning: amber/yellow
  - Error: red
  - Info: blue
  - Neutral: gray

### 3.3 Iconography
- Tabler icon set used throughout.
- Icons always paired with text for critical actions/status (except tiny status dots).

### 3.4 Spacing and layout
- Dense information layout with tight vertical rhythm.
- Rounded corners on cards, popovers, and dialogs.
- Subtle dividers for sections and list rows.

## 4. Global layout

### 4.1 Overall structure
The web client is a multi-panel layout with:
- **Header** (top bar)
- **Left sidebar** for tasks
- **Main content** for event stream
- **Optional left panel** for task chat
- **Optional right detail panel** for task details
- **Status bar** (bottom)

**Screenshot:** `spec/screenshots/01-app-main.png`

### 4.2 Resizable panels
- Task sidebar width is user-resizable by dragging its right edge.
- Task chat panel width is user-resizable by dragging its right edge.
- The right-side task details panel is fixed width with a maximum size based on window width.
- Panel width preferences persist across reloads.

### 4.3 Panel open/close behavior
- Task chat panel toggles on/off via hotkey and UI controls.
- Task details panel opens when a task is selected and closes via Escape, close button, or clicking outside.

## 5. Header

### 5.1 Header contents
Left to right:
- App logo (icon + “Ralph” text)
- Workspace picker
- Instance count badge (only when more than one instance is active)
- Merge conflict notification (only when active instance is paused due to conflicts)
- Persistence error notification (only when event persistence fails)

Right to left:
- Connection status indicator
- Help (keyboard shortcuts) button
- Settings dropdown button

**Screenshots:**
- `spec/screenshots/02-header-default.png`
- `spec/screenshots/03-header-multiple-instances.png`
- `spec/screenshots/41-header-notifications.png`
- `spec/screenshots/42-header-disconnected.png`

### 5.2 Workspace picker
**Closed state**
- Displays workspace name (or “No workspace” / “Server not running”).
- Shows an optional pill with issue count.

**Open state**
- Shows a scrollable list of workspaces, each with:
  - Colored folder icon
  - Workspace name
  - Optional active issue count
  - Checkmark on the active workspace
- A “Refresh” action at the bottom.
- Error state shows an error message and a Retry button.

**Screenshots:**
- `spec/screenshots/04-workspace-picker.png`
- `spec/screenshots/05-workspace-picker-open.png`

### 5.3 Connection status indicator
- States: Connected (icon only), Connecting, Disconnected.
- When not connected, a label appears next to the icon.

**Screenshot:** `spec/screenshots/42-header-disconnected.png`

### 5.4 Notifications
**Merge conflict banner**
- Shows a warning icon and text: “{instance} paused: merge conflict in N files.”

**Persistence error banner**
- Shows error color, “Failed to save N events to local storage.”
- Includes “Retry” and “Dismiss” icon buttons.

**Screenshot:** `spec/screenshots/41-header-notifications.png`

### 5.5 Settings dropdown
- Opens from a gear icon in the header.
- Sections:
  - **Appearance** toggle: System / Light / Dark (button group).
  - **Theme list** (filtered by current light/dark mode): selectable items with checkmark on active theme.
  - **Export state** action: triggers download of a state export file.
- Error state shows an inline error message with a retry icon.

**Screenshots:**
- `spec/screenshots/06-settings-dropdown.png`
- `spec/screenshots/43-theme-picker.png`

## 6. Command palette

- Opens as a modal overlay with a search input and command list.
- Actions shown depend on app state (e.g., Start is hidden when running).
- Each command shows a label, description, and its keyboard shortcut.
- Supports keyboard navigation (Up/Down, Enter) and filtering by text.

**Screenshot:** `spec/screenshots/07-command-palette.png`

## 7. Hotkeys dialog

- Modal dialog listing all keyboard shortcuts by category.
- Categories are clearly labeled (uppercase section headers).
- Each row shows action name and shortcut keys.

**Screenshot:** `spec/screenshots/08-hotkeys-dialog.png`

## 8. Status bar (bottom)

Left cluster:
- Control bar (Start / Pause / Stop / Stop-after-current)
- Status indicator (Stopped / Starting / Running / Pausing / Paused / Stopping / Stopping after task)
- Run duration (time since last start)

Right cluster:
- Repo/branch display
- Token usage (input/output)
- Context window progress
- Session progress (current session number / total)

**Screenshots:**
- `spec/screenshots/09-status-bar.png`
- `spec/screenshots/10-control-bar.png`
- `spec/screenshots/39-context-window-progress.png`
- `spec/screenshots/40-token-usage.png`

## 9. Task sidebar

### 9.1 Structure
- Top: quick task input
- Floating search bar pinned at the top of the task list
- Task list grouped by status
- Bottom: task progress bar (only while agent is active)

**Screenshot:** `spec/screenshots/11-task-sidebar.png`

### 9.2 Quick task input
- Single-line textarea that auto-expands for multi-line text.
- Submit on Enter; Shift+Enter creates a new line.
- Send button disabled until there is non-whitespace input.
- While submitting, button shows spinner.

**Screenshot:** `spec/screenshots/15-quick-task-input.png`

### 9.3 Task search
- Search input filters tasks in real time.
- Clear “X” appears when a query is present.
- Keyboard navigation:
  - Arrow Up/Down moves selection through visible tasks.
  - Enter opens the selected task.
  - Escape clears selection and query, then blurs.

**Screenshot:** `spec/screenshots/16-search-input.png`

### 9.4 Task list grouping and collapse
- Three status groups: **Open**, **Deferred**, **Closed**.
- Open group includes tasks with status Open / In Progress / Blocked.
- Group header shows:
  - Chevron (collapse/expand)
  - Group label
  - Optional time filter dropdown (Closed group only)
  - Count pill
- Closed group filter options: Past hour, Past 4 hours, Past day, Past week, All time.

**Screenshots:**
- `spec/screenshots/12-task-list-default.png`
- `spec/screenshots/13-task-list-collapsed.png`

### 9.5 Task cards
Each task row contains:
- Expand/collapse chevron when the task has children
- Status icon (with spinner for “In Progress”)
- Task ID (monospace)
- Title (struck-through when closed)
- Subtask count badge (if applicable)
- Session history indicator (clock icon)
- Issue type icon (Bug / Feature / Epic)
- Priority badge (P0, P1, P3, P4 only; P2 omitted)

Selection state:
- Selected task has a tinted background and an accent ring.

**Screenshot:** `spec/screenshots/14-task-card.png`

### 9.6 Task progress bar
- Appears at the bottom of the sidebar only while the agent is running/paused/stopping-after-current.
- Shows closed tasks / total visible tasks (excluding epics).

**Screenshot:** `spec/screenshots/38-task-progress-bar.png`

## 10. Task details panel (right side)

### 10.1 Layout
- Opens as a right-side panel.
- Header includes status icon, task ID, and a close button.
- Content scrolls independently.

**Screenshot:** `spec/screenshots/17-task-details.png`

### 10.2 Editable fields
- Title (single-line text area, auto-resizing)
- Description (markdown editor)
- Status (button group with icons)
- Priority (button group P0–P4)
- Type (Task, Bug, Epic)
- Parent (combobox with searchable tasks; “None” option)
- Labels (chips with remove buttons; add label input)

### 10.3 Related information sections
- **Sessions**: list of related sessions with date/time and event counts. Clicking navigates to session view.
- **Related tasks**: collapsible lists of Children, Blocked by, and Blocks.
- **Comments**: chronologically listed with author and relative time; input at bottom for adding new comments.

**Screenshots:**
- `spec/screenshots/20-session-links.png`
- `spec/screenshots/18-related-tasks.png`
- `spec/screenshots/19-comments-section.png`

### 10.4 Delete flow
- “Delete” button shows confirmation state.
- Confirmation presents “Yes, delete” and “Cancel.”
- Delete errors appear inline.

### 10.5 Save behavior
- Changes auto-save in the background.
- A “Saving…” indicator appears in the footer while saving.
- Cmd/Ctrl+Enter closes the panel (after saving).

## 11. Event stream (main content)

### 11.1 Session bar
- Shows current task ID + title, or “No active task” / “Choosing a task…”
- Previous / Next session buttons
- “Current” button returns to live session
- Session history dropdown opens a searchable list grouped by date

**Screenshots:**
- `spec/screenshots/21-event-stream-default.png`
- `spec/screenshots/33-session-history-dropdown.png`

### 11.2 Event list behavior
- Auto-scrolls to newest events while viewing live session.
- If the user scrolls up, a floating “Latest” button appears.

**Screenshot:** `spec/screenshots/37-scroll-to-latest.png`

### 11.3 Empty, running, and historical states
- Empty (live, stopped): “Ralph is not running” with Start button.
- Running: active spinner appears at the bottom of the stream.
- Historical: content is static and auto-scroll is disabled; loading state shown while fetching.

**Screenshots:**
- `spec/screenshots/22-event-stream-empty.png`
- `spec/screenshots/23-event-stream-running.png`
- `spec/screenshots/24-event-stream-historical.png`

### 11.4 Event types and presentation

**Assistant text**
- Markdown-rendered, serif typography.
- Inline links and code formatting supported.

**Screenshot:** `spec/screenshots/32-assistant-text.png`

**User messages**
- Right-aligned, rounded message bubble.

**Screenshot:** `spec/screenshots/31-user-message.png`

**Thinking block**
- Collapsible “Thinking…” row with muted, italicized content when expanded.
- During streaming, it appears expanded by default.

**Screenshot:** `spec/screenshots/44-thinking-block.png`

**Tool use cards**
- Compact summary row with status dot and tool name.
- Expand/collapse toggles output visibility.
- Output handling:
  - Edit: inline diff view
  - Bash: formatted terminal output
  - Todo updates: list of items with statuses
  - Generic output: preview with “+N lines” when truncated

**Screenshots:**
- `spec/screenshots/25-tooluse-edit.png`
- `spec/screenshots/26-tooluse-bash.png`
- `spec/screenshots/27-tooluse-todo.png`

**Error events**
- Red bordered card with warning icon and error message.

**Screenshot:** `spec/screenshots/28-error-event.png`

**Task lifecycle events**
- Blue “Starting” and green “Completed” cards with task ID and title.

**Screenshot:** `spec/screenshots/29-task-lifecycle-event.png`

**Session completion**
- Purple card labeled “Session Complete.”

**Screenshot:** `spec/screenshots/30-promise-complete-event.png`

## 12. Task chat panel (left)

### 12.1 Structure
- Header with “Task Chat” label, clear history button, and optional close button.
- Scrollable message list with floating input at bottom.

**Screenshots:**
- `spec/screenshots/34-task-chat-empty.png`
- `spec/screenshots/35-task-chat-conversation.png`

### 12.2 Empty state
- Centered icon and instructional copy: “Manage your tasks.”

### 12.3 Input behavior
- Single input area with Send button.
- Enter to send, Shift+Enter for new line.
- Disabled state when not connected.

### 12.4 Loading and error states
- Spinner appears while processing.
- Error text appears above the input.

**Screenshot:** `spec/screenshots/36-task-chat-error.png`

## 13. Keyboard shortcuts

The following shortcuts are displayed in the Hotkeys dialog and should match behavior:

### 13.1 Agent control
- Start: Cmd+Enter
- Stop: Ctrl+C
- Pause/Resume: Cmd+.
- Stop after current: Cmd+Shift+.

### 13.2 Navigation
- Focus sidebar: Cmd+1
- Focus main content: Cmd+2
- Focus task chat input: Cmd+3
- Show task search: Cmd+K
- Focus chat input: Cmd+L
- Cycle focus through inputs: Tab
- Toggle task chat: Cmd+J
- Previous session: Cmd+[
- Next session: Cmd+]
- Latest session: Cmd+\
- Focus search: Cmd+F
- Previous workspace: Cmd+Shift+[
- Next workspace: Cmd+Shift+]
- Toggle tool output: Ctrl+O
- Previous task: ArrowUp
- Next task: ArrowDown
- Open selected task: Enter

### 13.3 Appearance / help
- Cycle theme: Ctrl+T
- Show hotkeys: Cmd+/
- Command palette: Cmd+;
- Export state: Cmd+Shift+E

## 14. Navigation and URL behavior

### 14.1 Task deep links
- Opening a task updates the URL to `/issue/{taskId}`.
- Closing the task panel returns to the root URL.

### 14.2 Session deep links
- Viewing a historical session updates the URL to `/session/{sessionId}`.
- Returning to live session clears the session URL and returns to root.

## 15. Persistence of UI preferences

The following preferences persist across reloads:
- Sidebar width
- Task chat panel open/closed state and width
- Theme preference (light/dark/system + chosen theme)
- Task search query
- Closed tasks time filter

## 16. Acceptance criteria (E2E coverage)

Existing E2E tests serve as acceptance criteria for the behaviors they cover. Each test should pass without modification.

### 16.1 Event stream
- `ui/e2e/event-stream.spec.ts`
  - Visibility of event stream and session bar
  - Session navigation behaviors
  - Spinner states
  - Interaction with tasks
  - Scroll-to-bottom behavior

### 16.2 Task chat
- `ui/e2e/chat.spec.ts`
  - Panel visibility and toggling
  - Input behavior and message sending
  - Clear history control
  - Empty state presentation
  - Resizing and panel width
  - Interaction with tasks

### 16.3 URL routing
- `ui/e2e/url-routing.spec.ts`
  - Task dialog routing
  - Session routing
  - Combined routing scenarios

### 16.4 Layout
- `ui/e2e/layout.spec.ts`
  - Panel layout presence and sizing

### 16.5 Task-session linking
- `ui/e2e/task-session-linking.spec.ts`
  - Session links visibility in task details
  - Navigation from task details to session view

### 16.6 Persistence
- `ui/e2e/persistence.spec.ts`
  - Sidebar width persistence
  - Theme persistence
  - Task chat panel persistence
  - Search query persistence
  - Closed tasks filter persistence

### 16.7 Navigation
- `ui/e2e/navigation.spec.ts`
  - Keyboard navigation and focus behaviors

## 17. Coverage gaps (explicit)

The following UI behaviors are **not** covered by current E2E tests and must be manually validated:
- Settings dropdown appearance and theme list content
- Command palette filtering and selection details
- Task details form validation and delete flow
- Related tasks and blocker management
- Comments section create/edit behavior
- Header notifications (merge conflict, persistence failure)
- Connection status indicator variants
- Tool output expand/collapse behavior
- Thinking block expand/collapse behavior

