# Web Client UX Functional Specification

**Product:** Ralph Web Client

## 0. Overview

This is an application for managing coding agents working on a software project.

It has two primary components:

- **Tasks:** A human-friendly UI on top of an agent-friendly task database - [Beads](https://github.com/steveyegge/beads) or something like it. The database is embedded in each git repo (workspace) that the user is working on, and supports detailed descriptions, comments, dependencies, and subtasks. The agents have straightforward CLI tools for managing this database, and the human user can view and edit tasks manually. In addition, a **task chat** window also allows the user to interact with a specialized task-management agent, who can discuss problems with the user, investigate issues, and create tasks accordingly, as well as help the user manage tasks with a natural-language interface.

- **Ralph loop:** A process running Claude Code (or equivalent) agents on a "Ralph Wiggum" loop. Each agent is spawned with the same standing prompt that instructs it to pick a task, work on it until it's done, test it, commit its work, close the task, and shut down. The next agent is spawned with the same instructions. And so on until all tasks are complete - at which point the loop stops. The system supports running multiple Ralph loops in parallel.

The software development workflow that this supports is one of breaking down implementation plans into granular, focused tasks, and having agents steadily complete the tasks one at a time. Because the tasks are small and well-defined and each instance of the agent just has to work on one thing, it has a good chance of successfully completing the task with no further human intervention. These agents' work is visible to the user while in progress, and the user can send messages to an active agent if needed for course correction or clarification; but the process could also be left running overnight. In parallel, the human is free to review the emerging product and add more tasks, bug reports, etc. to the queue as needed.

## 1. Scope, principles, and definitions

**Scope:** This document specifies the complete user experience of the web client only. It intentionally excludes all implementation, architecture, data storage, or technical stack details. It is written to allow a separate agent to rebuild the user experience with high fidelity.

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

| #   | Screenshot                         | Purpose                                                  |
| --- | ---------------------------------- | -------------------------------------------------------- |
| 01  | `01-app-main.png`                  | Full app layout with data                                |
| 02  | `02-header-default.png`            | Header baseline                                          |
| 03  | `03-header-multiple-instances.png` | Header with instance count badge                         |
| 04  | `04-workspace-picker.png`          | Workspace picker closed                                  |
| 05  | `05-workspace-picker-open.png`     | Workspace picker open                                    |
| 06  | `06-settings-dropdown.png`         | Settings dropdown open                                   |
| 07  | `07-command-palette.png`           | Command palette                                          |
| 08  | `08-hotkeys-dialog.png`            | Hotkeys dialog                                           |
| 09  | `09-status-bar.png`                | Status bar                                               |
| 10  | `10-control-bar.png`               | Control bar                                              |
| 11  | `11-task-sidebar.png`              | Task sidebar                                             |
| 12  | `12-task-list-default.png`         | Task list default groups                                 |
| 13  | `13-task-list-collapsed.png`       | Task list collapsed groups                               |
| 14  | `14-task-card.png`                 | Task card styling                                        |
| 15  | `15-quick-task-input.png`          | Quick task input                                         |
| 16  | `16-search-input.png`              | Task search input                                        |
| 17  | `17-task-details.png`              | Task details panel                                       |
| 18  | `18-related-tasks.png`             | Related tasks section                                    |
| 19  | `19-comments-section.png`          | Comments section                                         |
| 20  | `20-session-links.png`             | Task session links                                       |
| 21  | `21-event-stream-default.png`      | Event stream with content                                |
| 22  | `22-event-stream-empty.png`        | Event stream empty state                                 |
| 23  | `23-event-stream-running.png`      | Event stream running state                               |
| 24  | `24-event-stream-historical.png`   | Event stream historical session                          |
| 25  | `25-tooluse-edit.png`              | Tool use: Edit diff                                      |
| 26  | `26-tooluse-bash.png`              | Tool use: Bash output                                    |
| 27  | `27-tooluse-todo.png`              | Tool use: Todo update                                    |
| 28  | `28-error-event.png`               | Error event card                                         |
| 29  | `29-task-lifecycle-event.png`      | Task lifecycle event card                                |
| 30  | `30-promise-complete-event.png`    | Session complete card                                    |
| 31  | `31-user-message.png`              | User message bubble                                      |
| 32  | `32-assistant-text.png`            | Assistant text with markdown                             |
| 33  | `33-session-history-dropdown.png`  | Session history dropdown open                            |
| 34  | `34-task-chat-empty.png`           | Task chat empty state                                    |
| 35  | `35-task-chat-conversation.png`    | Task chat with messages                                  |
| 36  | `36-task-chat-error.png`           | Task chat error state                                    |
| 37  | `37-scroll-to-latest.png`          | Scroll-to-latest button                                  |
| 38  | `38-task-progress-bar.png`         | Task progress bar                                        |
| 39  | `39-context-window-progress.png`   | Context window progress                                  |
| 40  | `40-token-usage.png`               | Token usage display                                      |
| 41  | `41-header-notifications.png`      | Header notifications (merge conflict, persistence error) |
| 42  | `42-header-disconnected.png`       | Header with disconnected status                          |
| 43  | `43-theme-picker.png`              | Theme picker list                                        |
| 44  | `44-thinking-block.png`            | Thinking block                                           |

## 3. Visual language

### 3.1 Typography

- Primary sans-serif for UI (IBM Plex Sans) with clear hierarchy.
- Monospace used for IDs, commands, and technical snippets (IBM Plex Mono).
- Serif used for assistant prose/long-form responses (IBM Plex Serif).

### 3.2 Color and theming

- Supports Light, Dark, and System appearance modes.
- System mode follows the OS preference; the theme list is filtered by the resolved mode.
- Theme list is sourced from the user’s VS Code installation and is split into light and dark categories.
- The active theme selection is scoped to the current mode. When switching between light and dark, the app restores the last theme chosen in that mode.
- Switching theme to a dark theme automatically switches appearance to Dark; switching to a light theme switches appearance to Light.
- A workspace accent color tints key UI elements (header background, selection rings, progress bars).
- The workspace accent color is derived from that repo’s VS Code Peacock color setting.
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
- Divider lines use neutral border colors and never inherit the workspace accent color.

## 4. Global layout

### 4.1 Overall structure

The web client is a multi-panel layout with:

- **Header** (top bar)
- **Left sidebar** for tasks
- **Main content** for event stream
- **Optional left panel** for task chat
- **Optional left overlay panel** for task details
- **Status bar** (bottom)

**Screenshot:** `spec/screenshots/01-app-main.png`

### 4.2 Resizable panels

- Task sidebar width is user-resizable by dragging its right edge.
- Task chat panel width is user-resizable by dragging its right edge.
- The task details panel is fixed width with a maximum size based on window width.
- Panel width preferences persist across reloads.

### 4.3 Panel open/close behavior

- Task chat panel toggles on/off via hotkey and UI controls.
- Task details panel opens when a task is selected and closes via Escape, close button, or clicking outside.
- Task chat panel sits to the far left of the layout, with the task sidebar immediately to its right.
- Task details panel opens from the left edge of the main content area and overlays the event stream without covering the sidebar.

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
- Shows an optional pill with open + in-progress issue count.
- The workspace name and folder icon reflect the active workspace and its accent color.

**Open state**

- Shows a scrollable list of workspaces, each with:
  - Colored folder icon
  - Workspace name
  - Optional active issue count
  - Checkmark on the active workspace
- A “Refresh” action at the bottom.
- Error state shows an error message and a Retry button.
- Workspace rows show only the name (no path/subtitle).
- On workspace switch, UI state refreshes to the new workspace (tasks, accent color, repo/branch, and session history).

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
- Theme list displays the last selected theme in the current mode; if none has been chosen, the button label shows “Default.”
- If no themes are discovered for the current mode, the list shows “No themes found.”
- Error state shows an inline error message with a retry icon.
- Theme selection occurs on click (hover does not apply a theme).

**Screenshots:**

- `spec/screenshots/06-settings-dropdown.png`
- `spec/screenshots/43-theme-picker.png`

## 6. Command palette

- Opens as a modal overlay with a search input and command list.
- Actions shown depend on app state (e.g., Start is hidden when running).
- Each command shows a label, description, and its keyboard shortcut.
- Supports keyboard navigation (Up/Down, Enter) and filtering by text.
- Search placeholder text: “Type a command or search...”.
- Filtering is fuzzy and uses command labels plus configured keywords.
- Clicking outside the palette or pressing Escape closes it.
- Empty results show “No commands found.”

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

Additional behavior:

- Status indicator uses a colored dot + label; “Starting/Pausing/Stopping” pulses.
- Run duration appears only while a run is active and updates once per second.
- Repo/branch shows repo name and branch separated by a slash; hidden when neither is known.
- Token usage is always visible (including 0/0) with ↓ input and ↑ output counts.
- Context window progress appears only when usage > 0 and shifts color at higher usage thresholds.
- Session progress appears only when the session total is known (> 0).

**Screenshots:**

- `spec/screenshots/09-status-bar.png`
- `spec/screenshots/10-control-bar.png`
- `spec/screenshots/39-context-window-progress.png`
- `spec/screenshots/40-token-usage.png`

### 8.1 Control bar details

- **Start**: enabled only when stopped and connected.
- **Pause/Resume**: toggles based on current state.
- **Stop**: immediate stop of current run.
- **Stop-after-current**: toggles into a “Cancel stop after current” state when active.
- If a control action fails, an inline error message appears to the right of the buttons.

## 9. Task sidebar

### 9.1 Structure

- Top: quick task input
- Floating search bar pinned at the top of the task list
- Task list grouped by status
- Bottom: task progress bar (only while agent is active)
- When there are no tasks, the list area shows “No tasks yet.”

**Screenshot:** `spec/screenshots/11-task-sidebar.png`

### 9.2 Quick task input

- Single-line textarea that auto-expands for multi-line text.
- Submit on Enter; Shift+Enter creates a new line.
- Send button disabled until there is non-whitespace input.
- While submitting, button shows spinner.
- Placeholder text: “Tell Ralph what you want to do”.

**Screenshot:** `spec/screenshots/15-quick-task-input.png`

### 9.3 Task search

- Search input filters tasks in real time.
- Clear “X” appears when a query is present.
- Placeholder text: “Search tasks...”.
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
- Closed tasks are ordered with most recently closed first.
- When empty group display is enabled, empty groups still render headers and show “No tasks in this group.”

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
- Type icon column always reserves space (placeholder shown when no icon) so row alignment is consistent.

Selection state:

- Selected task has a tinted background and an accent ring.

**Screenshot:** `spec/screenshots/14-task-card.png`

### 9.6 Task progress bar

- Appears at the bottom of the sidebar only while the agent is running/paused/stopping-after-current.
- Shows closed tasks / total visible tasks (excluding epics).
- The denominator honors the closed-tasks time filter (closed tasks outside the filter are excluded).

**Screenshot:** `spec/screenshots/38-task-progress-bar.png`

## 10. Task details panel (left side)

### 10.1 Layout

- Opens as a left-side panel overlaying the main content area.
- Header includes status icon, task ID, and a close button.
- Content scrolls independently.
- The rest of the UI remains interactive while the panel is open.

**Screenshot:** `spec/screenshots/17-task-details.png`

### 10.2 Editable fields

- Title (single-line text area, auto-resizing)
- Description (markdown editor)
- Status (button group with icons)
- Priority (button group P0–P4)
- Type (Task, Bug, Epic)
- Parent (combobox with searchable tasks; “None” option)
- Labels (chips with remove buttons; add label input)
- Status/priority/type groups support left/right arrow key navigation.
- Labels: “Add label” appears as a dashed pill; label input placeholder is “Label name”.
- When read-only and no labels exist, the labels row shows “No labels”.

### 10.3 Related information sections

- **Sessions**: list of related sessions with date/time and event counts. Clicking navigates to session view. Hidden if there are no sessions or while loading has failed.
- **Related tasks**: collapsible lists of Children, Blocked by, and Blocks. Each list shows a count in the section label.
  - Sections are hidden if they have no items; the entire “Related” section is hidden in read-only mode when empty.
  - Sections are expanded by default.
  - “Blocked by” items show a remove (X) action on hover when editable.
  - “Add blocker” opens a task search dropdown (search placeholder “Search tasks...”, empty state “No tasks available.”).
- **Comments**: chronologically listed with author and relative time; input at bottom for adding new comments.
  - Comment input placeholder: “Add a comment (Enter to submit, Shift+Enter for new line)...”.
  - Enter submits; Shift+Enter inserts a new line.
  - Input auto-expands; send button shows a spinner while submitting.
  - Loading state shows “Loading comments...”; errors appear inline.

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
- While edits are in progress, background updates do not overwrite user input.

## 11. Event stream (main content)

### 11.1 Session bar

- Shows current task ID + title, or “No active task” / “Choosing a task…”
- Previous / Next session buttons
- “Current” button returns to live session
- Session history dropdown opens a list grouped by date
- History groups are labeled “Today”, “Yesterday”, or a specific date label.
- The currently viewed session is highlighted and marked with a check icon.
- The most recent “Today” session shows a running spinner when the agent is active.
- When no sessions are available, the dropdown shows “No session history yet.”
- A search field appears only when there are 5+ sessions.
- Search placeholder: “Search sessions...”.
- Search matches task ID, task title, and session ID.
- Empty search shows “No sessions found.”
- Items show task title + task ID when available; they do not show a history icon, timestamps, or event counts.
- Selecting a session replaces the current main view (does not open a sidebar).
- The dropdown is available while viewing historical sessions.
- The dropdown does not include a separate “Current session” row; the current session appears as the highlighted item.

**Screenshots:**

- `spec/screenshots/21-event-stream-default.png`
- `spec/screenshots/33-session-history-dropdown.png`

### 11.2 Event list behavior

- Auto-scrolls to newest events while viewing live session.
- If the user scrolls up, a floating “Latest” button appears.
- Event stream does not duplicate events during reconnects or refreshes.

**Screenshot:** `spec/screenshots/37-scroll-to-latest.png`

### 11.3 Empty, running, and historical states

- Empty (live, stopped): “Ralph is not running” with Start button.
- Running: active spinner appears at the bottom of the stream.
- Historical: content is static and auto-scroll is disabled; loading state shown while fetching.
- Historical session with no events shows “No events found for this session.”

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
- Clicking the summary row toggles the global output state (disclosure triangle ▸/▾ reflects state).
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

### 11.5 Message input (main)

- A single-line message input sits below the event stream (above the status bar).
- Visible only while viewing the latest session; hidden for historical sessions.
- Auto-focused on page load.
- Disabled when disconnected or when the agent cannot accept messages.
- Placeholder text:
  - Disconnected: “Connecting...”
  - Stopped/unavailable: “Start Ralph to send messages...”
  - Ready: “Send a message...”
- The floating “Latest” button appears above the input and is never obscured by it.

## 12. Task chat panel (left)

### 12.1 Structure

- Header with “Task Chat” label, clear history button, and optional close button.
- Scrollable message list with floating input at bottom.
- The panel is open by default on first load; open/closed state persists.
- Clear history removes all messages and starts a fresh conversation.

**Screenshots:**

- `spec/screenshots/34-task-chat-empty.png`
- `spec/screenshots/35-task-chat-conversation.png`

### 12.2 Empty state

- Centered icon and instructional copy: “Manage your tasks.”

### 12.3 Input behavior

- Single input area with Send button.
- Enter to send, Shift+Enter for new line.
- Disabled state when not connected.
- Placeholder text reflects state:
  - Disconnected: “Connecting...”
  - Loading: “Waiting for response...”
  - Ready: “How can I help?”

### 12.4 Loading and error states

- Spinner appears while processing.
- Error text appears above the input.
- Task chat messages appear exactly once; the stream must never duplicate or garble content.
- Tool output expansion/collapse uses the same toggle behavior as the main event stream.

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
- Cycle focus through inputs: Tab (task search ↔ main message input)
- Toggle task chat: Cmd+J (if open and unfocused, first press focuses input; second press closes)
- Previous session: Cmd+[
- Next session: Cmd+]
- Latest session: Cmd+\
- Focus search: Cmd+F
- Previous workspace: Cmd+Shift+[
- Next workspace: Cmd+Shift+]
- Toggle tool output: Ctrl+O
- New task chat (clear history): Cmd+Backspace
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
- Comment drafts are preserved per task when switching between tasks.

## 16. Acceptance criteria (E2E coverage)

Existing E2E tests serve as acceptance criteria for the behaviors they cover. Each test should pass without modification.

### 16.1 Event stream

- `packages/ui/e2e/event-stream.spec.ts`
  - Visibility of event stream and session bar
  - Session navigation behaviors
  - Spinner states
  - Interaction with tasks
  - Scroll-to-bottom behavior

### 16.2 Task chat

- `packages/ui/e2e/chat.spec.ts`
  - Panel visibility and toggling
  - Input behavior and message sending
  - Clear history control
  - Empty state presentation
  - Resizing and panel width
  - Interaction with tasks

### 16.3 URL routing

- `packages/ui/e2e/url-routing.spec.ts`
  - Task dialog routing
  - Session routing
  - Combined routing scenarios

### 16.4 Layout

- `packages/ui/e2e/layout.spec.ts`
  - Panel layout presence and sizing

### 16.5 Task-session linking

- `packages/ui/e2e/task-session-linking.spec.ts`
  - Session links visibility in task details
  - Navigation from task details to session view

### 16.6 Persistence

- `packages/ui/e2e/persistence.spec.ts`
  - Sidebar width persistence
  - Theme persistence
  - Task chat panel persistence
  - Search query persistence
  - Closed tasks filter persistence

### 16.7 Navigation

- `packages/ui/e2e/navigation.spec.ts`
  - Keyboard navigation and focus behaviors

## 17. Closed-issue-derived UX requirements (systematic pass)

This section captures UX constraints surfaced by closed bd issues and commit history. It supplements the sections above and should be treated as required behavior.

### 17.1 Connection and error handling

- The header includes a connection indicator with three states:
  - Connected: green dot only (no label)
  - Connecting: yellow dot with “Connecting” label
  - Disconnected: red dot with “Disconnected” label
- When the agent API connection fails, the event stream shows a red error card.
- Retriable failures show a non-fatal error message: “Retrying in X seconds… (attempt N/M)”.
- Reconnect attempts use exponential backoff with jitter; after the maximum attempts, a permanent error event is shown and the status remains disconnected until a manual reconnect.
- The UI must not spin indefinitely without an error when a connection error is present.

### 17.2 Session history and event stream

- Session dropdown entries show the associated task title when available; do not show “No task” for sessions that have a task.
- Historical session loading is stable (no flicker/loop). If no events exist, show “No events found for this session.”
- `<promise>COMPLETE</promise>` renders as a purple “Session complete” event card styled like task start/end cards.
- Event stream does not duplicate events on reconnect or hot reload.

### 17.3 Task chat

- Task chat maintains a continuous conversation context across messages; “Clear history” resets to a fresh conversation.
- Assistant responses appear alongside tool usage; task chat messages never appear twice or garble text.
- Tool output expansion is a global toggle: Ctrl+O applies in both the event stream and task chat.
- Tool cards are also clickable to toggle expansion; a disclosure triangle (▸/▾) reflects state.

### 17.4 Task list and search

- Closed tasks are ordered by most recently closed first (including parent groups).
- “Open” and “Closed” section headers remain visible even when empty; show “No tasks in this group” when empty.
- Task search supports multiple words and matches when all words appear in any order across id, title, or description.
- Closed-task time filters affect closed-task counts in progress indicators.

### 17.5 Layout regressions to avoid

- Task details panel slides in from the left, inside the main content area.
- The details panel does not add a full-screen dimming overlay; click outside closes it.
- Panel order is: main event stream → task chat (left) → task sidebar (right) → details panel (overlays main area).
- Divider lines use neutral border colors, not the workspace accent.

### 17.6 Status bar and controls

- Status bar and control bar are always visible at the bottom of the main area.
- Conditional elements only render when data is available:
  - Repo/branch label
  - Context window progress
  - Session/iteration progress
- Token usage and context window indicators reflect the current session and reset on new sessions.

### 17.7 Workspace scoping

- Session history, event logs, and task chat history are scoped to the active workspace; switching workspaces does not leak items from other workspaces.

## 18. Coverage gaps (explicit)

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

## Appendix A: Closed issue ledger

This appendix enumerates all closed bd issues reviewed for this spec pass.

- r-vg9vm - .ralph/state.latest.json not being created despite useDevStateExport hook
- r-7v9gz - Task chat creates new SDK session for each message instead of maintaining session continuity
- r-i9nwg - Make search bar more flexible - support matching multiple words in any order
- r-zr5e2 - Context window progress bar should show current session usage, not total
- r-wjneu - ctrl+o doesn't expand tool use in task chat - outputs remain permanently collapsed
- r-z9gpz - Task chat still showing duplicated text despite fix
- r-h80qv - Render <promise>COMPLETE</promise> tag similarly to start/end task tags
- r-e6bl2 - Task chat output is garbled with duplicated text
- r-zhmyx - Events appearing twice in event log due to React StrictMode
- r-34ad1 - Fix Ralph's default workspace path to be repo root instead of /ui
- r-67oz4 - Add taskId fallback calculation from events
- r-8sl3x - Update session taskId immediately on ralph_task_started
- r-j4fbg - Delete useEventPersistence hook
- r-16pd6 - Support timestamp-based catch-up on reconnect
- r-099bs - Include working directory in Claude's context/prompt
- r-htaxr - All sessions show 'No task' in session dropdown
- r-zzk16 - Enable extended thinking in ClaudeAdapter
- r-a1y7v - Fix task editing being reset by polling updates
- r-hx3ag - Fix infinite loading loop when viewing previous sessions
- r-dogu - Remove IndexedDB schema migrations
- r-edkt - Session dropdown shows no sessions
- r-rugt - Session dropdown shows no sessions
- r-rdd0 - Simplify IndexedDB schema
- r-z6pp - Add state export button to capture app state for Storybook
- r-pc5x - Token counts always show 0/0 in status bar despite fixes
- r-x7wr - make storybook stories for the task chat dropdown and the iteration dropdown
- r-hjc7 - for closed tasks, order recently closed tasks first
- r-e3pq - Task chat panel not responding to messages
- r-nhb0 - In task chat I don't see any assistant responses - only tool use
- r-t9td - Make format command run silently
- r-1ymj - We're getting these warnings again when testing
- r-7bon - Task name missing from iteration toolbar
- r-i2od - Status bar and controls missing from bottom of screen
- r-lmi3 - Task list: show section headers even when empty
- r-zhab - Task chat: include CLAUDE.md and working directory in system prompt
- r-ze1c - Reduce test output verbosity in pnpm test:all
- r-g64h - Cmd+J should focus chat if not focused, then toggle on next press
- r-mjpn - Chat briefly shows response twice
- r-j66q - Optimize test:all for agent usage
- r-v5ff - Connection reliability and error handling
- r-ni2i - Improve WebSocket reconnection with exponential backoff
- r-1gmb - Add visual connection status indicator
- r-lf71 - Add retry mechanism for Claude API connection errors
- r-8bub - MainLayout: remove accent color from panel dividers
- r-enbi - MainLayout: fix detail panel positioning (should slide from left)
- r-1b9y - MainLayout: fix panel order (task chat should be left of sidebar)
- r-0k0a - Fix missing aria-describedby warnings in Sheet/Dialog components
- r-9fzm - Remove auto-titling feature
- r-ejm4 - E2E tests pollute repo's beads database with test issues
- r-aet - it doesn't seem like the messages I send to ralph are getting through
- r-unv4u - Use event's session_id for IndexedDB session attribution
- r-ewtbw - Use event.uuid as primary IndexedDB deduplication key
- r-50rlm - Storybook tests fail: node:fs externalized for browser compatibility
- r-mvrm8 - TypeScript error in useTaskChatSessions.test.ts: Type 'undefined' not assignable to 'string'
- r-rloxt.9 - Store workspaceId when persisting task chat sessions
- r-rloxt.8 - Scope event logs to current workspace in useEventLogs
- r-rloxt.7 - Scope task chat hydration to current workspace
- r-rloxt.6 - Add workspace-aware task chat query methods to EventDatabase
- r-rloxt.5 - Add workspaceId to TaskChatSessionMetadata and persist it
- r-rloxt.4 - Pass workspace context from store to chat/event log components
- r-rloxt.3 - Update useTaskChatSessions to filter by workspace and tag sessions on save
- r-rloxt.2 - Update useEventLogs to filter sessions by current workspace
- r-rloxt.1 - Add workspaceId to TaskChatSessionMetadata and IndexedDB schema
- r-rloxt - Task chat and event logs should be scoped to workspace
- r-dajrq - Fix duplicate React keys causing console warnings
- r-hrard - Ralph runner Claude constructs incorrect absolute file paths
- r-l8s70 - WebSocket connection stuck in 'connecting' state when welcome message fails
- r-00xac - Previous sessions show no events in event log when selected
- r-j5ypi - TypeScript error: unused variable 'timestamp2' in ralphConnection.test.ts
- r-9oog2 - TypeScript errors in ralphConnection.test.ts - missing mock methods
- r-a67rw - TypeScript errors in ralphConnection.test.ts - missing mock methods
- r-a98vp - TypeScript compilation errors in Storybook decorators and persist tests
- r-tufi7.45.2 - Reconcile Zustand events with IndexedDB on hydration
- r-tufi7.45.1 - Add error handling and retry logic for IndexedDB event persistence
- r-tufi7.45 - Events stored in both Zustand and IndexedDB with manual sync
- r-7i2ck - IndexedDB as source of truth for sessions/events
- r-1lt1u - TypeScript error: ConnectionStatusIndicator passing style prop to Icon component
- r-b6kf6 - Test failure in importState.test.ts: fetchCompressedState fetch failure test
- r-afre4 - Failing test: importState > fetchCompressedState > should throw on fetch failure
- r-xujyq - Persist draft comments per task
- r-xfw8l - Task chat session should not reset when current task changes
- r-hfw4y - Filter out empty sessions from session history
- r-q0j4c - Improve session menu styling and layout
- r-8p5lk - Fix TypeScript errors in exportState and importState tests
- r-55qms - Fix session boundary detection to recognize ralph_session_start events
- r-p10b - Sessions not appearing in dropdown
- r-0gbr - Test failure: useEventPersistence error handling test expects outdated console.error signature
- r-wkkl - Fix failing test: TaskChatManager maxTurns mismatch
- r-n88u - Token usage & context progress bar have disappeared
- r-yu9v - TypeScript compilation errors in useTaskDetails.ts and useEventLogs.test.ts
- r-ro0e - Fix failing test: TaskChatManager sendMessage SDK query options
- r-mo91 - Syntax error in playwright.config.ts - missing value in ternary expression
- r-4u7i - Test failure in NewInstanceDialog.test.tsx - flaky 'Creating...' button state test
- r-p0ap - TypeScript build errors: iterationCount prop mismatch and missing currentTaskChatSessionId
- r-3iwe - Clean up IterationHistorySheet and E2E tests after History button removal
- r-h8h2 - Test failure: TaskSidebar story 'All Slots Rendered In Order' cannot find slot-iteration-history element
- r-75xg - TypeScript build errors in store tests - missing currentTaskChatSessionId property
- r-1qe6 - Build errors in test files: missing currentTaskChatSessionId property
- r-sxzc - Build error: Missing setCurrentTaskChatSessionId in AppActions
- r-00v3 - Fix iterations showing 'No task' instead of task title
- r-8ftw - Remove 'Current Session' iterations from dropdown
- r-ynyz - TypeScript error in useIterations.ts: Type '(IterationSummary | null)[]' not assignable to 'IterationSummary[]'
- r-181q - Fix task chat loading old session on refresh
- r-2waq - Fix events log overlaying message input and control bar
- r-zvcp - E2E tests failing: API timeout when creating tasks
- r-t24p - Remove History button and panel below task list
- r-1xfw - Build errors: TaskSidebar props mismatch after search refactor
- r-zo82 - E2E test failure: chat.spec.ts - creating a task does not affect chat panel visibility
- r-s9uo - Remove redundant localStorage persistence for current session iterations
- r-kte0 - E2E tests fail with net::ERR_CONNECTION_REFUSED - Vite server instability during Playwright tests
- r-ekqo - e2e tests failing: ENOTEMPTY error in global-setup.ts
- r-5x8n - MainLayout.stories.tsx Default test failure - cannot find 'Implement login page'
- r-n6f7 - Test failure: NewInstanceDialog loading state test fails
- r-gwbn - Test failure: IterationHistoryPanel 'Date Groups Display' story failing
- r-fega - Test flake: DateGroupsDisplay story test fails due to stale date comparison
- r-7tuz - Fix missing timestamps on SDK events causing 'default-undefined' iteration IDs
- r-5kc7 - E2E test setup fails when beads database already exists
- r-apmp - Verify iteration persistence works across refresh
- r-fzjx - Update parent components to pass iterations instead of eventLogs
- r-9q1f - Update EventStreamIterationBar to use iterations prop
- r-pjeq - Update IterationHistoryDropdown to use iterations prop
- r-p6f8 - Update IterationHistoryPanel to use useIterations
- r-kaop - Create useIterations hook
- r-6t1y - Fix iteration persistence: UI reads from wrong IndexedDB store
- r-fbf7 - open task rows are taller than closed/blocked/in-progress rows - probably the icon placeholder needs to be be w-_ rather than size-_
- r-35yy - Test timeout: useWorkspaces 'fetches workspaces on mount' times out after 60s
- r-0465.6 - Remove server-side event log storage
- r-0465.5 - Update IterationLinks to use IndexedDB
- r-0465.4 - Update useEventLogRouter to use IndexedDB
- r-0465.3 - Update saveEventLogAndAddComment to use IndexedDB
- r-0465.2 - Create useEventLogs hook for IndexedDB queries
- r-0465.1 - Add EventLog types and IndexedDB stores
- r-0465 - Event logs stored on server instead of client
- r-no26 - MainLayout.stories.tsx Default test failing - sidebar role/name mismatch
- r-kx7x - Build error: Cannot find module '@storybook/test'
- r-eo05 - E2E test failures in websocket-reconnection.spec.ts
- r-kja1 - dev.js should respect inherited WORKSPACE_PATH
- r-9xiu - Add placeholder div for task type icon in open tasks
- r-mrlo - Fix failing useStreamingState test: deduplication keeps both assistant events when far apart
- r-2fhb - TaskChatHistoryDropdown test fails: 'groups sessions by date' cannot find 'Today' text
- r-qn1e - Test failure: NewInstanceDialog loading state test fails
- r-j4i5 - Fix doubled assistant responses in task chat
- r-pyb0 - Add iteration history dropdown to event stream bar
- r-cxeo - Add useTaskChatPersistence hook to save task chat sessions
- r-5esz - Add useIterationPersistence hook to save iteration state
- r-hibl - Settings dropdown button is disabled during theme loading
- r-bejk - Unified event display components
- r-4ttk - Client-side persistence and reconnection
- r-enij.4 - Clean up iteration events file when iteration completes - delete .ralph/iteration-events.jsonl after events are archived to eventlogs
- r-enij.3 - Restore current task info on page load - after restoring events, display correct active task instead of 'No active task'
- r-enij.2 - Restore events from disk on page load - when WebSocket connects, retrieve events from iteration-events.jsonl if iteration is active
- r-enij.1 - Persist events to disk during active iteration - save events to .ralph/iteration-events.jsonl while iteration is active
- r-s73k - Test failures: TaskDetailsDialog autosave and CodeBlock copy button tests
- r-zdak - Fix 'Ralph is not running' error when Ralph is actually running
- r-wnz2 - Fix failing useHotkeys test for cycleTheme hotkey (Cmd+Shift+T)
- r-7g2j.4 - Style button groups with rounded corners and gray borders
- r-7g2j.3 - Remove Done button from TaskDetailsDialog
- r-7g2j.2 - Remove toolbar from MarkdownEditor in TaskDetailsDialog description
- r-7g2j.1 - Change TaskDetailsDialog form layout to horizontal
- r-7g2j - TaskDetailsDialog changes
- r-dyh1 - Flaky test: blockerApi.test.ts 'adds a blocker successfully' has race condition
- r-xqf4 - blockerApi.test.ts fails with EADDRINUSE port conflict
- r-479e - Test failures: server tests timing out and blockerApi POST endpoint returning 500
- r-cuwd - I'm not seeing blocked tasks in the issue list
- r-clys - TaskChatManager test failure: sendMessage SDK query options mismatch
- r-42rz - Investigate why manage-tasks skill changes don't apply
- r-2i06 - don't show any icon for open tasks - the circle makes it look like a checkbox or a selection indicator
- r-3mjn - On the task chat we're getting everything at least twice
- r-lhy1 - Fix flaky Playwright test: Escape closes search and clears it
- r-7ruy - Flaky test: Cmd+J focuses task chat input when opening panel
- r-p4hy - TypeScript build errors: missing taskChatToolUses and taskChatStreamingText properties in AppState
- r-8ko5 - Flaky Playwright test: Escape closes search and clears it
- r-fwb7 - TypeScript errors in chat fixtures test file
- r-fplk - TypeScript errors in chat fixtures test file
- r-5m4e - Batch or throttle task-chat:event store updates
- r-0ysb - TypeScript errors in TaskChatPanel.tsx - missing AssistantMessageBubble component
- r-dtyl.5 - Show iteration link on task detail view
- r-dtyl.4 - Add iteration detail/replay view
- r-dtyl.3 - Add iteration history list UI
- r-dtyl.2 - Store iteration log ID on closed tasks
- r-dtyl.1 - Auto-save iteration events on completion
- r-dtyl - Iteration history and task linking
- r-q75v - Test failure in TaskChatPanel: renders assistant messages with markdown
- r-b3ip - TypeScript build errors in TaskChatPanel.tsx
- r-d5fm - WorkspacePicker error state test fails - expects error message in 2 places but only finds 1
- r-t545.5 - Clean up deprecated task chat state
- r-t545.4 - TaskChatPanel: use shared streaming state and content rendering
- r-t545.3 - ralphConnection: populate unified taskChatEvents array
- r-t545.2 - Store: add taskChatEvents unified array
- r-t545.1 - TaskChatManager: emit raw SDK events instead of transformed events
- r-t545 - Unify TaskChatPanel and EventStream event models
- r-5uim - Build errors: unused imports in App.tsx
- r-1e6x - Build error: JSX syntax in .ts file (replay.ts)
- r-wnhn - Fix flaky quick-task-input E2E tests
- r-z8qi - E2E test failures in quick-task-input and navigation tests
- r-xeo9.3 - Add replay tests for TaskChatPanel using event fixtures
- r-xeo9.2 - Add test fixtures from logged task chat events
- r-xeo9.1 - Add TaskChatEventLog to persist task chat events to file
- r-xeo9 - Task chat: Add event logging and replay testing
- r-xo2e - Persist input text to local storage
- r-mz8o - TypeScript build errors: Missing reconnection choice dialog state in store
- r-joqa - TypeScript errors: showReconnectionChoice property missing from AppState type
- r-82xo - Test failure: newChat hotkey test uses wrong key
- r-00of - Button groups: add color-coded borders and backgrounds to unselected buttons
- r-mi31 - WorktreeManager.test.ts beforeEach hook times out
- r-cmcf - QuickTaskInput E2E tests failing - input not clearing after submission
- r-ulns - Test port conflict: api.test.ts and iterationStateApi.test.ts both use port 3097
- r-6nv0 - Task chat: error_max_turns on longer queries
- r-04j8 - Update hotkey bindings
- r-2d1x - Improve active task visibility in task list
- r-1mo1.4.5 - Add iteration state cleanup logic
- r-1mo1.4.4 - Enhance client reconnection logic for state restoration
- r-1mo1.4.3 - Add API endpoints for iteration state restoration
- r-1mo1.4.2 - Wire iteration state saving into RalphRegistry
- r-1mo1.4.1 - Create IterationStateStore for file-based persistence
- r-4g35 - Child tasks should inherit parent epic's priority by default
- r-1mo1.4 - Sync iteration state to server for page reload survival
- r-1mo1.3 - Add UI option for continue vs start fresh after reconnection
- r-1mo1.2 - Resume iteration from last successful point on reconnection
- r-1mo1.1 - Save conversation context before API calls in ClaudeAdapter
- r-7teq - Task list: separately query for dependency-blocked issues
- r-68z9 - Consolidate task lists: show blocked, in-progress, ready under Open
- r-v2p3 - Test failure: ScrollToBottomButton.test.tsx - missing @testing-library/user-event dependency
- r-11sz - Theme discovery shows wrong themes
- r-c7op.5 - Migrate TaskChatPanel to use AutoScroll
- r-c7op.4 - Migrate EventStream to use AutoScroll
- r-c7op.3 - Create AutoScroll component
- r-c7op.2 - Extract ScrollToBottomButton component
- r-c7op.1 - Extract useAutoScroll hook from EventStream and TaskChatPanel
- r-1mo1 - Preserve iteration context on API reconnection
- r-fsxl - Render error events in EventStream
- r-u86f - QuickTaskInput E2E test failing: input not clearing after successful submission
- r-ipcr - E2E test failure: 'Escape clears search even when not focused' - cannot focus disabled textarea
- r-c7op - Refactor: Unify TaskChatPanel and EventStream into shared ContentStream
- r-39t8 - Task chat: Fix unstable block ordering during response
- r-461y - Task chat: Fix duplicate tool use events
- r-b339 - Playwright e2e tests timeout waiting for web server
- r-476l - If there's anything in the search box and esc is pressed, it should clear the text box regardless of whether it's focused or not
- r-chz0 - Test failure: Kbd component test expects font-mono class but implementation uses font-medium
- r-0u0u - E2E test failure: search input not accepting keyboard input
- r-dahu - E2E test failure: Navigation > focus management > search accepts keyboard input
- r-tris - on the issue form, don't stretch button groups to fill the available horizontal space
- r-4j55 - in the issue detail form, remove 'Deferred' from the status options, and display this as a button group.
- r-b8c3 - Event log shows plain text for task start instead of structured block
- r-1oi6 - E2E test failure: localStorage draft not cleared after successful task submission
- r-aqat - Task chat cannot display tool uses
- r-fpdy - Task chat has no context due to missing tool access
- r-df7i - I'm no longer seeing the current task in the iteration toolbar
- r-349e - Simplify detail panel width: fixed max 800px, 200px right margin
- r-fpuj - Issue sheet closes when using controls like status dropdown
- r-pg10 - Keep closed subtasks grouped with siblings until parent closes
- r-jzfy - E2E test failure: app.spec.ts assumes idle state but Ralph may be running
- r-dj38 - CLI tests for parseTaskLifecycle are out of sync with implementation
- r-k7a1 - Fix TypeScript errors in CLI package
- r-lafv - Update task lifecycle parser to use XML tags
- r-3kp6 - IterationBar shows 'no active task' because ralph_task_started events not emitted
- r-6b9i - parseTaskLifecycleEvent regex too strict - doesn't match Claude's actual output
- r-6tsf - 4 test failures in ToolUseCard.test.tsx ANSI color rendering
- r-u1i4.4 - Update all tests and callers of TaskChatManager
- r-u1i4.3 - Update TaskChatManager constructor to accept SDK instance instead of spawn config
- r-u1i4.2 - Implement SDK-based sendMessage() method with streaming support
- r-u1i4.1 - Research Claude Agent SDK query() API and streaming patterns
- r-j82p - Update TaskChatManager tests for SDK-based implementation
- r-bw1l - Remove CLI-specific code from TaskChatManager (handleStdout, parseStreamLine, buffer)
- r-u1i4 - Replace spawn/CLI with SDK query() in TaskChatManager.sendMessage()
- r-ylj7 - Refactor TaskChatManager to use Claude Agent SDK instead of CLI subprocess
- r-z5wb - Issue sheet tweaks
- r-9jaw - TaskChatManager sets status to 'idle' instead of 'error' on failures
- r-qcon - TaskChatManager test failures: status not transitioning to 'error' after failures
- r-z9br - TaskChatManager status not set on errors
- r-k4ta - Fix flaky test: EventLogStore API endpoints - GET /api/eventlogs/:id
- r-kszn - Document multi-agent support
- r-30rg - Add agent config to RalphManager
- r-9o1f - Update IterationRunner to use AgentAdapter
- r-3yg2 - Add --agent CLI flag
- r-palk - Create CodexAdapter
- r-9r4i - Define AgentAdapter interface and AgentEvent types
- r-5es - bug: Build fails due to TypeScript error in TaskCard.tsx - onClick prop conflict with HTMLAttributes
- r-ees - Test failures: taskChatOpen initial state mismatch
- r-fow - TaskIdLink: only match task IDs with the repo's prefix (e.g. rui-xxx), not arbitrary hyphenated words
- r-rks - Test failure: gitBranch.test.ts - git commit fails in test setup
- r-ar2 - Test failure: Tab key toggle focus test in App.test.tsx
- r-j9s - Fix failing App.test.tsx Tab key focus test
- r-r0q - Tests fail: systemPrompt tests expect header format not in actual prompt file
- r-jij - Fix failing systemPrompt tests - default prompt format mismatch
- r-bgq - Fix systemPrompt.test.ts test failures
- r-3lj.4 - Integrate event log capture into task closing workflow
- r-3lj.3 - Create EventLogViewer component for right panel
- r-3lj.2 - Add URL hash routing for event log viewing (#eventlog={id})
- r-3lj.1 - Add backend API for event log storage (POST/GET /api/eventlogs)
- r-4vp.7 - Wire up TaskChatPanel in App.tsx and integrate all components
- r-4vp.6 - Add hotkeys for task chat panel (toggle panel, focus chat input)
- r-4vp.5 - Add state management for task chat panel (open/closed, width, conversation history)
- r-4vp.4 - Add Claude API integration for task chat conversations
- r-4vp.3 - Create default system prompt for task management chat
- r-4vp.2 - Create TaskChatPanel component for task management conversations
- r-4vp.1 - Extend MainLayout to support an optional third pane (task chat panel)
- r-ib2 - Test failure: QuickTaskInput localStorage not cleared after successful submission
- r-3lj - Store event log per iteration; display via URL (#eventlog={id}); auto-link when closing task
- r-5q9 - the task count for a workspace should exclude closed tasks
- r-40w - in the sidebar, tasks that belong to an epic should be shown grouped under that epic
- r-8rl - Fix failing test: TaskList 'shows all closed tasks when all_time is selected'
- r-4vp - Add a third pane for task management conversations with Claude - a side conversation about tasks like creating, updating, and organizing issues
- r-0p7 - Separate iterations in events view
- r-9to - TypeScript build errors in story files and vite.config.ts
- r-fcf - TaskSidebar test failure: 'does not render quickInput area when not provided' expects wrong border count
- r-an8 - Fix failing tests: TaskSidebar.test.tsx and App.test.tsx
- r-766.4 - Add debug logging to diagnose hang locations
- r-766.2 - Test MessageQueue timeout/completion scenarios
- r-766.1 - Investigate MessageQueue hang behavior
- r-766 - in some repos we seem to be hanging towards the end of a task
- r-3xf4t.6 - Final completeness review (no architecture refs)
- r-3xf4t.5 - Add cross-cutting behaviors and edge cases
- r-3xf4t.4 - Draft UX-only functional spec
- r-3xf4t.3 - Capture high-fidelity screenshots
- r-3xf4t.2 - Document per-screen inputs/outputs and states
- r-3xf4t.1 - Inventory web client screens and global UI
- r-3xf4t - Web client UX functional spec
- r-1n7br.5 - Produce test suite recommendation report
- r-1n7br.4 - Map tests to critical workflows
- r-1n7br.3 - Sample and classify test value
- r-1n7br.2 - Collect test suite metadata
- r-1n7br.1 - Inventory unit tests by package
- r-1n7br - Unit test suite review
- r-7r110.5 - Filter broadcast by workspace to prevent event leakage
- r-7r110.2 - Fix timestamp equality bug causing event loss on reconnect
- r-56n9o - Add IndexedDB migration to deduplicate corrupted event data
- r-fc9uu - Add sessionId to ralph_session_end, ralph_task_started, ralph_task_completed events
- r-luhtu.4 - Add tests for unified URL-based session navigation
- r-luhtu.3 - Remove in-memory session navigation from store (goToPreviousSession, goToNextSession, viewingSessionId)
- r-luhtu.2 - Refactor Current/Return-to-live button to use URL-based navigation
- r-luhtu.1 - Refactor Previous/Next buttons to use URL-based navigation
- r-luhtu - Unify session navigation to use URL and IndexedDB for all controls
- r-owvc9.3 - Update session bar layout: Previous | Dropdown | Next | Current
- r-owvc9.2 - Replace ← Live button with Current button
- r-owvc9.1 - Add Previous/Next navigation buttons to EventStreamSessionBar
- r-ac882.3 - Add IndexedDB eviction policy for old sessions and events
- r-ac882.2 - Implement bounded Maps with cleanup in ralphConnection.ts
- r-ac882.1 - Add max event count enforcement in Zustand store
- r-ac882 - Chrome shows high memory usage after running for a while
- r-ydlqw - ClaudeAdapter doesn't emit thinking block events to UI
- r-owvc9 - Update session navigation: add previous/next/current buttons
- r-tufi7.55.4 - Implement client-side task chat reconnection sync
- r-tufi7.55.3 - Add task-chat:reconnect WebSocket message handler on server
- r-tufi7.55.2 - Store task chat events server-side with timestamps
- r-tufi7.55.1 - Add event timestamp tracking for task chat
- r-tufi7.49.4 - Replace implicit null returns with explicit filter predicates
- r-tufi7.49.3 - Add debug mode for event filtering visibility
- r-tufi7.49.2 - Add EventFilterPipeline module to consolidate filtering logic
- r-tufi7.49.1 - Document the full event filtering pipeline
- r-tufi7.32.2 - Add tests for useStreamingState accumulation behavior
- r-tufi7.32.1 - Refactor useStreamingState to use immutable accumulation pattern
- r-tufi7.20.4 - Add tests for client-authoritative task chat messages
- r-tufi7.20.3 - Update client to send message history with chat requests
- r-tufi7.20.2 - Remove server-side message history from TaskChatManager
- r-tufi7.20.1 - Investigate current TaskChat message flow
- r-tufi7.12.5 - Phase 5: Update tests for store changes
- r-tufi7.12.4 - Phase 4: Update persist.ts to remove flat field syncing
- r-tufi7.12.3 - Phase 3: Remove legacy flat fields from AppState interface
- r-tufi7.12.2 - Phase 2: Update actions to only update instances Map (remove flat field updates)
- r-tufi7.12.1 - Phase 1: Add deprecation comments and ensure all selectors read from instances Map
- r-tufi7.5.3 - Update batch timeout tests in store/index.test.ts
- r-tufi7.5.2 - Remove explicit status-based flush in ralphConnection.ts
- r-tufi7.5.1 - Reduce task chat event batch interval from 100ms to 16ms
- r-tufi7.45.3 - Consider reactive IndexedDB (Dexie liveQuery) for Zustand sync
- r-tufi7.55 - Task chat has no reconnection state recovery unlike Ralph sessions
- r-tufi7.54 - Event ID generation inconsistent across sources
- r-tufi7.50 - Instance status can be updated without updating corresponding flat field
- r-tufi7.49 - Event rendering happens at multiple layers with potential for skipped events
- r-tufi7.46 - Task chat clear operations span multiple systems without coordination
- r-tufi7.41 - No deduplication of events in Zustand store after reconnection
- r-tufi7.40 - useTaskChatPersistence relies on implicit order of events vs messages for session boundary detection
- r-tufi7.39 - activeInstanceId change doesn't trigger re-hydration
- r-tufi7.37 - Timestamp-based deduplication fallback is fragile
- r-tufi7.36 - Session persistence relies on effect timing for boundary detection
- r-tufi7.34 - Server event history can diverge from client on workspace switch
- r-tufi7.32 - Streaming state tracked via mutable accumulation in useStreamingState
- r-tufi7.31 - Hydration restores state without coordinating with live WebSocket data
- r-tufi7.30 - CLI and UI have different session definitions
- r-tufi7.29 - useStoreHydration ignores workspace scope
- r-tufi7.26 - Task chat session ID restored from two independent sources with race potential
- r-tufi7.25 - Index-based event tracking in useEventPersistence is fragile
- r-tufi7.24 - Session ID generation creates different IDs for same session
- r-tufi7.22 - Two parallel event-to-display-block transformers with divergent implementations
- r-tufi7.20 - Server TaskChatManager holds authoritative message history but client builds its own
- r-tufi7.18 - Session state duplicated between instances Map and flat fields
- r-tufi7.13 - Instance events not cleared on workspace switch
- r-tufi7.12 - Legacy flat fields in Zustand store create dual sources of truth
- r-tufi7.11 - Event persistence uses index-based IDs causing potential overwrites
- r-tufi7.10 - Task chat events persisted via two independent paths with different formats
- r-tufi7.9 - Race condition between welcome message and pending_events on reconnection
- r-tufi7.8 - Dual source of truth: store events vs IndexedDB events
- r-tufi7.7 - Dual session boundary detection creates fragile state
- r-tufi7.6 - Dual event persistence creates potential for data inconsistency
- r-tufi7.5 - Dual state locations for task chat: messages in Zustand, events in batched module state
- r-tufi7.4 - IndexedDB queries not scoped by workspaceId
- r-tufi7.2 - Session ID generated in UI hook creates implicit dependency
- r-tufi7.1 - Dual session ID tracking creates source of truth confusion
- r-tufi7 - Architecture review: Find anti-patterns
- r-hv049 - Filter sessions without tasks from dropdown
- r-5fspp - Write events directly to IndexedDB in ralphConnection
- r-uoyap - Add UUID to RalphEvent on server
- r-vsjg3 - Position 'scroll to latest' button 30px higher
- r-8gofg - Context window progress bar not calculating percentage correctly
- r-rkklp - Refactor token usage extraction into pure function
- r-ao9mt - Remove 'Theme not found' error when no themes exist
- r-qh88z - Don't auto-start Ralph on UI load
- r-wt619 - Clean up task ID/title handling
- r-9zgbv - Make primary inputs float above their panels
- r-u6myj - Store resizable panel widths as percentage of window width instead of pixels
- r-f8pc1 - Reduce polling frequency to every 5 seconds
- r-dwxnr - Remove EventLogViewer sidebar from codebase
- r-0z47j - Fix 409 error on page reload when Ralph is already running
- r-agga5 - Add more padding below spinner in event logs
- r-bxnbz - Remove refresh themes button
- r-rbyh - Filter themes by current display mode
- r-f7ci - Change theme on click instead of hover
- r-63ip - Remove theme label lines from settings menu
- r-pxld - Sync SessionHistoryDropdown menu text with status bar text
- r-fy4h - Fix SessionHistoryDropdown styling to match SettingsDropdown
- r-8c1g - Use /session/{id} URL when showing previous state
- r-kana - Show session dropdown when viewing previous session
- r-xew6.5 - Update Storybook config to serve fixtures
- r-xew6.4 - Create App.stories.tsx with state replay story
- r-xew6.3 - Add withImportedState decorator to decorators.tsx
- r-xew6.2 - Create importState.ts for restoring state from JSON
- r-xew6.1 - Install fflate for gzip decompression
- r-xew6 - Add Storybook story for full app state replay
- r-kykx - Clicking session in dropdown should replace current view, not open sidebar
- r-55dk.3 - Add theme states to store
- r-55dk.2 - Add input draft states to store
- r-55dk.1 - Add task list collapsed states to store
- r-cqg4 - Style Claude's thinking blocks differently from user-facing text
- r-g3o7 - Make header icons larger
- r-55es.3 - Store task chat events in unified events store
- r-55es.2 - Merge task_chat_metadata and task_chat_sessions into single chat_sessions store
- r-55es.1 - Merge session_metadata and sessions into single sessions store
- r-1qh3 - Task chat spinner stops before streaming completes
- r-2mcf - Hide search bar in session dropdown when fewer than 5 items
- r-rw1s - Fix delete button hover color to be red with reversed text
- r-hjr0.9 - Update EventDatabase.test.ts to remove event_logs tests
- r-hjr0.8 - Migrate saveEventLogAndAddComment to use sessions
- r-hjr0.7 - Migrate useEventLogRouter hook to use sessions
- r-hjr0.6 - Migrate useTasksWithEventLogs hook to use sessions
- r-hjr0.5 - Migrate useEventLogs hook to use sessions
- r-iwp9 - Move connection indicator from footer to header right side
- r-8i7j - Move connection indicator from status bar to header
- r-g5yp - Show elapsed time in session status bar
- r-5mdq - Remove history icon from session dropdown items
- r-z0ub - Remove time and event count from session dropdown
- r-hov9 - Add spinner next to current task in session dropdown
- r-dhdg - Look up task titles on the fly for session history
- r-gdb6 - Use /session/{id} URL pattern for session logs
- r-fdsp - Change session logs URL to /session/{id}
- r-hjr0.4 - Remove event_logs and event_log_metadata from database schema
- r-hjr0.3 - Update SessionLinks to use sessions instead of event_logs
- r-hjr0.2 - Update saveEventLogAndAddComment to link sessions instead of event logs
- r-hjr0.1 - Migrate #eventlog URL routing to #session routing
- r-55es - Unify event storage across sessions and task chat
- r-hjr0 - Remove event_logs tables - use sessions instead
- r-er5l - Make logo inherit text color from surroundings
- r-55dk - Consolidate separate localStorage items into ralph-ui-store
- r-jipu - Store all timestamps as Unix timestamps
- r-9ua7 - Investigate why sessions dropdown is not appearing in event stream
- r-z0hl - Use cached task data for instant dialog opening
- r-6pt1 - Reset token usage and context window when new session starts
- r-wl7u - Fix 'latest' button being hidden behind message input
- r-7czg - Sessions not persisted to IndexedDB - missing system init event
- r-dt6t - Display 'Choosing a task...' in session status bar before task selection
- r-1p5z - Task lifecycle events missing task title in display
- r-f8p9 - Remove border above message input for task chat and session log
- r-4fwc - Add padding to bottom of event log
- r-snwc - Test task for chat E2E
- r-vu4s - Remove task chat history dropdown
- r-65af - Close URL Test 1769428656247
- r-iuj0 - Back Nav Test 1769428656660
- r-2lsq - URL Test Task 1769428656074
- r-ebas - First Task 1769426592039
- r-0pj9 - Add keyboard shortcut for exporting state
- r-tt2d - Always show search bar and focus on Cmd+F
- r-l0kz - Hide QuickTaskInput panel in TaskSidebar
- r-k90z - E2E tests still pollute main repo when dev server running
- r-wzff - Update CLAUDE.md with new data model documentation
- r-p8qq - Add tests for event operations
- r-rwf5 - Update server to broadcast workspaceId with events
- r-et13 - Update session loading to fetch events separately
- r-4sjx - Update useSessionPersistence to metadata-only saves
- r-h86u - Create useEventPersistence hook
- r-azzc - Add EventDatabase methods for event operations
- r-28ii - Implement v2→v3 migration logic
- r-ko39 - Create events object store in EventDatabase
- r-p5rq - Add schema v3 types and update PERSISTENCE_SCHEMA_VERSION
- r-rbp0 - Normalize IndexedDB schema: separate events table
- r-yodn - E2E tests should clean up created tasks
- r-nrqc - Fix Storybook text color defaulting to accent color
- r-h5j8 - ctrl+o shows details for tool use in the ralph event log, but not in the task chat
- r-u2m6 - the "closed" heading should always be visible, even if there are no closed tasks. Same for "open". "Blocked" and "deferred" should only show up if there are tasks under them
- r-z2bh - Ralph server status check is misleading
- r-c4z1 - I should be able to type in the chat task even if claude hasn't ended his turn
- r-11u2 - I'm no longer seeing closed tasks
- r-s8uo - the iterations in the dropdown should be labeled with the name of the task they worked on
- r-ofrt - Test UI state persistence
- r-5t1k - Update hydrateInstances to merge with persisted state
- r-5tfa - Update store initialization
- r-184c - Remove manual localStorage functions
- r-rytr - Apply persist middleware to store
- r-7hop - Create Zustand persist configuration
- r-24z6 - Document iteration event log feature
- r-ly3d - Improve visibility of iteration event log links
- r-f5oy - the task list takes a while to update when tasks are modified
- r-aa0e.1.6 - Cleanup: remove old TaskChatPanel.tsx
- r-aa0e.1.5 - Migrate App.tsx to use TaskChatController
- r-aa0e.1.4 - Update TaskChatPanel stories to use presentational component
- r-aa0e.1.3 - Create TaskChatController container component
- r-aa0e.1.2 - Create TaskChat presentational component
- r-aa0e.1.1 - Create useTaskChat hook
- r-np7e - pressing "Stop after current" puts the UI into stopped mode, although the iteration doesn't actually stop. Events keep coming in, but the spinner stops and the message input is disabled and reads "Start Ralph to send messages..."
- r-aa0e.8 - Update CLAUDE.md with controller pattern conventions
- r-aa0e.7 - Refactor InstanceSelector to controller pattern
- r-aa0e.6 - Refactor TaskSidebar to controller pattern
- r-aa0e.5 - Refactor StatusBar to controller pattern
- r-aa0e.4 - Refactor Header to controller pattern
- r-aa0e.3 - Refactor EventStream to controller pattern
- r-aa0e.2 - Refactor TaskDetailsDialog to controller pattern
- r-aa0e.1 - Refactor TaskChatPanel to controller pattern
- r-aa0e - Implement controller/presentational pattern
- r-gkfu - Show context window usage progress bar and token stats in status bar
- r-ng9t - Show stopped spinner at bottom of idle chats
- r-zxg6 - Don't show 'Deferred' heading when there are no deferred tasks
- r-5gw7 - Focus ring for input group should use accent color
- r-nt8d - Fix brief duplicate messages in task chat
- r-x1ur - task chat should use the same spinner as the ralph log
- r-kcza - use the shadcn input-group for comments
- r-7qm4 - ctrl+o should expand/collapse tool use results on both the task chat and the ralph events log
- r-ecep - Add "connected" label to icon in status bar
- r-ldt0 - ChatInput: Fix submit button position for multi-line input
- r-k0da - the task chat history button should bring up a dropdown menu, not a whole sheet
- r-jd43.4 - E2E tests for WebSocket reconnection
- r-jd43.3 - E2E tests for task-to-iteration linking
- r-jd43.2 - E2E tests for task chat history panel
- r-jd43.1 - E2E tests for iteration history panel
- r-djjs - Add iteration link button to issue sheet
- r-6h76 - the deferred section doesn't need an age filter
- r-emtt - WorkspacePicker test failing - 'Server not running' text expected in 2 places but only in 1
- r-4bd1 - Task chat doesn't emit token usage from SDK result messages
- r-ogi1 - the 'send a message' input no longer has a top border, and the placeholder is clipped along the top
- r-bejk.1 - Remove unused UserMessageBubble and AssistantMessageBubble components
- r-7spx - History browsing UI
- r-jd43 - Add Playwright E2E tests for persistence features
- r-6cjg - Add integration tests for persistence
- r-jy6e - Add unit tests for EventDatabase
- r-jdmw - Create task chat session history panel
- r-v16u - Add task to iteration linking
- r-gp65 - Create iteration history panel
- r-uklv - Refactor TaskChatPanel to use EventList
- r-wp5y - Refactor EventStream to use EventList
- r-kwit - Create RalphEvent to ChatEvent converter
- r-rs9i - Create shared EventList component
- r-muec - Define ChatEvent type
- r-wgak - Add client-side reconnection handling
- r-27h9 - Implement reconnection sync protocol in server
- r-3a4x - Add per-client event tracking to server
- r-etcw - Hydrate store from IndexedDB on startup
- r-r7is - Create task chat persistence hook
- r-e1zr - Create iteration persistence hook
- r-bn7p - Create persistence types
- r-so1b - Create IndexedDB storage module
- r-4jcp - add gray borders around buttons in button groups
- r-uoqh - the placeholders for markdown fields is not aligned with where text actually ends up
- r-syyz - use a lightning bold icon instead of cloud for the connection indicator
- r-84yv - I still see 0 up and 0 down in the tokens indicator in the status bar
- r-5bcl - make a separate section for deferred tasks (between open and closed) that only appears if there are deferred tasks
- r-xsfp - add a flag to the server that logs out the events from the ralph process to the console
- r-v7g5 - put subtask counts flush against the parent task name (not right-aligned)
- r-8tmn.5 - Add tests for mutation event flow
- r-8tmn.4 - Update useTasks hook to consume mutation events
- r-8tmn.3 - Forward mutation events to WebSocket clients
- r-8tmn.2 - Add mutation event polling to WorkspaceContext
- r-8tmn.1 - Add BeadsClient class to server package for daemon communication
- r-p1xs - Extract shared event display component from EventStream and TaskChatPanel
- r-8tmn - Replace task list polling with beads daemon mutation events
- r-z1d0 - there are several spots in the app where we are using a color from the theme for buttons, hover states, etc. but we should be using the repo's accent color instead
- r-j7v6 - the command palette should be driven by the hotkeys file
- r-k06b - add a help icon next to the settings icon in the toolbar, that opens the hotkeys reference
- r-p3za - The color of markdown text should use an appropriate color from the team. Currently it changes when the light/dark switch is changed, but not when the theme is changed.
- r-pi1h - when switching themes:
- If I choose a dark theme, the overall mode should switch to dark. Ditto for a light theme.
- If I switch to dark, it should use the last dark theme I used. Ditto for switching to light.
- r-8m5q - the task list should display some kind of loading skeleton while waiting for data. Both when starting up, and when switching workspaces
- r-hn8d - I'm getting `E2E Test Task 000000000` in my tasks in this repo - that stuff should be happening in the test repo
- r-8ayp.3 - Integrate MarkdownEditor for comments
- r-8ayp.2 - Integrate MarkdownEditor for issue descriptions
- r-8ayp.1 - Create shared MarkdownEditor component
- r-8ayp - Add MDX markdown editor component
- r-khfq - use the shadcn ButtonGroup component for button groups
- r-7wk6 - for the indicator that displays whether we're connected to the server or not, use an icon instead of just a colored dot
- r-a7md - Don't show "no events yet", just show a spinner
- r-zdok.4 - task
- r-zdok.3 - task
- r-zdok.2 - task
- r-zdok.1 - task
- r-fcyb.3 - Add blockers UI section to TaskDetailsDialog
- r-fcyb.2 - Add API endpoints for dependency management
- r-fcyb.1 - Add BdProxy methods for dep add and dep remove
- r-i4bm - the buttons in button groups should have gray borders and the background color (when unselected) should be much fainter
- r-7p12 - The autoscroll function sometimes gets into a loop where the screen jitters up and down. It looks like the issue might have to do with the syntax highlighter - it looks like the vertical height of a code block changes when syntax highlighting is applied
- r-1k1v - sending messages to ralph seems to be broken
- r-4v3o - Move theme controls to settings dropdown with cog icon
- r-qy1d - Update placeholder text for inputs
- r-dh1q - when ralph is paused I should be able to send messages. That's the main use case of pausing, is so that it stops what it's doing so I can redirect it
- r-srm3 - Filter test workspaces from workspace picker UI
- r-vpgs - Clean up test-workspace entries from beads registry
- r-c4z3 - Each iteration should be labeled with the task it worked on
- r-7lh6 - The output in the event panel should be left-aligned rather than centered on the available horizontal space
- r-ch5g - fix flaky playwright tests
- r-hcur - remove the colored backgrounds from non-selected items in button groups, only show them on hover
- r-qml5 - when the issue sheet is open, the tab key should go through the fields (title -> description -> status etc.)
- r-0uhm - in hotkey list, use symbol for backspace
- r-rpyn - Use button group for status selector (open/in progress/etc)
- r-gpdl - add a "past 4 hours" filter option for closed tasks
- r-86wh - the in-progress spinner isn't spinning
- r-o4kd - we don't need to repeat "Ralph: running" in the header
- r-zdok - Display nested subtask hierarchy (grandchildren)
- r-ufnz - Handle deeply nested subtasks gracefully
- r-bh5y - Assistant response text colors not adjusting to selected theme
- r-dn2u - Remove continue/start fresh prompt, always resume
- r-3joy - Use VS Code format for hotkey bindings
- r-k8u7 - Esc key should hide command palette
- r-ju32 - Spinning icon should only appear on actively worked task
- r-3bj7.11.5 - Store: update tests for multi-instance support
- r-3bj7.11.4 - Store: add per-instance selectors
- r-3bj7.11.3 - Store: update actions to target active instance
- r-3bj7.11.2 - Store: delegate flat fields to active instance
- r-3bj7.11.1 - Store: add instances Map and default instance
- r-pmz1.1.4 - Add tests for WorkspaceContext and WorkspaceContextManager
- r-pmz1.1.3 - Migrate server/index.ts to use WorkspaceContextManager
- r-pmz1.1.2 - Create WorkspaceContextManager for managing multiple contexts
- r-pmz1.1.1 - Create WorkspaceContext class to encapsulate workspace-specific state
- r-fyzc - when I click on a task to open it, it should be highlighted and keyboard navigation should work
- r-weu0 - Comments added by agents should have author='Ralph'
- r-fcyb - Issue sheet: add UI to add/remove blockers
- r-xbdz - blockquote in assistant responses should not be italicized
- r-p1ml - Issue form: style selected button group items with solid color and white text
- r-tz7b - the message input shouldn't show up for previous iterations
- r-pmz1.4 - Update frontend to handle workspace-specific event streams
- r-pmz1.3 - Keep Ralph running when switching workspaces
- r-pmz1.2 - Store event history per-workspace using WorkspaceContext
- r-pmz1.1 - Refactor server to support multiple concurrent workspace contexts
- r-fc7t - Search bar: Tab should rotate through the three inputs
- r-rfwo - MainLayout: increase accent border to 6px with rounded bottom corners
- r-h7id - task chat should be to the left of the issue list
- r-1kpl - the tokens up/down count is still always 0/0
- r-8b0n - Style the task id and name in the TaskLifecycleEvent component more like the way they're styled in the task list
- r-ocey - Color-code priority badges with yellow→orange→red gradient
- r-w597 - in the issue form, the title is not text wrapping
- r-ol95 - replace the priority dropdown in the issue form with a button group
- r-yvxi - get rid of the toggle sidebar command - the list of tasks should always be visible
- r-c4a1 - use the <Kbd> component everywhere so they're styled consistently
- r-90d8 - use the accent color for the spinner
- r-hx78 - put a reasonable max-width on the event log output
- r-ew0a - within a given priority, show bugs first
- r-3bj7.32 - UI: show merge conflict notification
- r-3bj7.31 - WebSocket: add instance ID to message payloads
- r-3bj7.30 - Server API: add instance ID parameter to endpoints
- r-3bj7.29 - Controls: update for active instance
- r-3bj7.28 - Header: show active instance status
- r-3bj7.27 - RalphManager: update to run in worktree directory
- r-3bj7.26 - EventStream: filter by active instance
- r-3bj7.25 - WorktreeManager: create worktrees directory
- r-3bj7.24 - InstanceStore: create persistence layer
- r-3bj7.23 - Store: hydrate instance list from server
- r-3bj7.22 - Hook: update useRalphConnection for multi-instance
- r-3bj7.21 - WorktreeManager: handle merge conflicts
- r-3bj7.20 - Store: persist activeInstanceId in localStorage
- r-3bj7.19 - RalphRegistry: create class to manage multiple RalphManager instances
- r-3bj7.18 - WorktreeManager: implement worktree cleanup
- r-3bj7.17 - UI: create New Instance dialog
- r-3bj7.16 - Store: add instance management actions
- r-3bj7.15 - WorktreeManager: implement post-iteration merge workflow
- r-3bj7.14 - UI: create InstanceBadge component
- r-3bj7.13 - Store: add activeInstanceId
- r-3bj7.12 - Edge case: handle externally deleted worktree
- r-3bj7.11 - Store: refactor AppState for multiple instances
- r-3bj7.10 - UI: create InstanceSelector dropdown
- r-3bj7.9 - WorktreeManager: implement worktree creation
- r-3bj7.8 - UI: show instance count badge
- r-3bj7.7 - WorktreeManager: create class for worktree lifecycle
- r-3bj7.6 - Prompt: instruct agents to skip assigned tasks
- r-3bj7.5 - Store: add RalphInstance type
- r-3bj7.4 - Cleanup: remove instance state on exit
- r-3bj7.3 - Instance metadata: add agent name/ID
- r-3bj7.2 - UX: auto-select newly created instance
- r-3bj7.1 - Prompt: instruct agents to assign tasks to themselves
- r-80t0 - Task list shows stale data briefly when switching workspaces
- r-pmz1 - Workspace switching stops Ralph process in previous workspace
- r-nlu3 - p3 epics are showing up before p2 tasks. tasks should be listed by priority, regardless of type
- r-5tx5 - In the issue form, autosave all changes. replace Cancel/Save buttons with a single Done button
- r-2kum - keyboard navigation of tasks should work whether or not find is activated
- r-xl20 - Blocked section should show dependency-blocked tasks
- r-ewon - Task chat improvements
- r-k0c1 - Fix indentation in task list
- r-qwec - Issue list loses selection after opening with Enter key
- r-wn3u - Change the URL of an issue from `#id={id}` to `/issue/{id}`
- r-5hv7 - When looking at a closed issue, there should be a link to view the transcript of the iteration that closed it - something like /transcript/{id}
- r-qup2 - Task chat duplicates markdown rendering instead of using shared MarkdownContent
- r-n4na - Remove relationships section from issue sheet
- r-8lvi - use the accent color when navigating tasks using the keyboard
- r-v0ma - start ralph on first load
- r-8ne0 - QuickTaskInput: input not cleared after successful task submission
- r-j8cu - QuickTaskInput: Clear localStorage synchronously on submit to prevent race condition
- r-41zz - add a hotkey for clearing chat history
- r-j8vv - task chat should have access to the repository
- r-nhhn - when searching for tasks, it currently only shows tasks that are visible. it should include all tasks - including closed tasks that are filtered out by the "past hour/past day/etc." filter.
- r-dpjd.4 - Add tests for RelationshipGraph component
- r-dpjd.3 - Integrate RelationshipGraph into TaskDetailsDialog
- r-dpjd.2 - Implement RelationshipGraph component with SVG visualization
- r-dpjd.1 - Design relationship graph component layout and interactions
- r-edgs - bug: task chat still doesn't work
  Error: Failed to spawn Claude Code process: spawn node ENOENT
- r-nl7g - bug: when submitting a new issue, the text in the input is not cleared
- r-u77m - bug: clicking to open an issue no longer works
- r-1t7f - bug: currently ehii.3 and ehii.4 are showing up as children of ehii.5, and ehii itself is listed separately
- r-44r6 - Task chat is still broken:

Error: Failed to spawn Claude Code process: spawn node ENOENT

This should be using the sdk, not spawning the cli.

- r-a4ty - the issue detail sheet should be reflected in the url, e.g. /#id=r-3kp6
- r-2ho6 - Hitting enter in the comment input should commit the comment.
- r-dpjd - on the issue sheet, show the blocks/blocked by and parent/child relationships graphically
- r-9l9m - Make comments text smaller on the issue sheet
- r-a6oh - Clicking outside of issue detail sheet should close the sheet
- r-4uru.3 - Add tests for auto-titling feature
- r-4uru.2 - Integrate auto-titling into POST /api/tasks endpoint
- r-4uru.1 - Create background service for auto-titling tasks
- r-ehii.5 - Document shared package
- r-ehii.4 - Add shared prompt loader utility
- r-ehii.3 - Extract beads domain types
- r-ehii.2 - Extract agent event types + normalization
- r-ehii.1 - Add shared workspace package
- r-ehii - Share CLI/server code
- r-21ug - when I press pause it keeps running
- r-o8eo - persist task chat visibility
- r-h8c2 - From the search input, I want to be able to use the up and down arrows to navigate visible tasks, and enter to open them
- r-kf8d - make the input sheet twice as wide
- r-7g38 - when the input sheet is visible, I should be able to tab between its fields
- r-fqrc - strip color codes from bash results rather than trying to render the colors
- r-2zce - my messages to Ralph sent midstream are definitely not making it through to the claude process
- r-b6zv - I need a way to click on epics with subtasks to see their details. the expand/contract functionality should be just when I click on the caret
- r-dbzi - Fix Ctrl+O tool output toggle - connect showToolOutput state to ToolUseCard
- r-dagl - show subtasks under the parent task
- r-11op - changes to issue type aren't being persisted
- r-zs15 - for issues with type=task, don't show the icon in the issue list, since it's the default
- r-61yk - saving changes to an issue should close the sheet
- r-yp1g - when navigating to a previous iteration it should always auto-scroll to the bottom of the events
- r-bqrs.5 - UI: Show task context in IterationBar
- r-bqrs.4 - Server: Extract task from events and store in metadata
- r-bqrs.3 - CLI: Add taskId to iteration events in JsonOutput
- r-bqrs.2 - CLI: Track current task in IterationRunner
- r-bqrs.1 - CLI: Create parseTaskLifecycle.ts utility
- r-whno - task chat always times out after 2 minutes
- r-89m9 - esc should close the issue sheet
- r-uqq9 - Add a `category` field to the hotkey definitions, and use the json file to drive the keyboard shortcut reference so that it's always up to date
- r-mdhl - Make ToolUseCard respect actual theme
- r-yqsb - Strip task prefix
- r-nhtr - the task count for an epic should be flush with the task title, not right-aligned
- r-x91p - Color-code the "task" type icon green.
- r-4uru - immediately after adding a new task, use claude code in the background to come up with a concise title and move any details to the description
- r-yfa4 - use some kind of one-time animation to highlight new tasks as soon as they're added in the task list
- r-hy33 - only show the search bar when it's active
- r-nw9x - get rid of the modal when hovering over tasks
- r-2c14 - Ralph's "✨ starting..." output hasn't been replaced with the structured block in the output of the current iteration
- r-bqrs - Associate iterations with tasks worked on
- r-w15i - the issue details sheet shouldn't be a modal. It should slide out from under the right side of the issue list, and partially cover the right-hand pane. The rest of the app's UI should still be accessible when it's visible.
- r-kti4 - task chat is hanging on "Thinking..."
- r-doqn - completed iterations shouldn't show a spinner
- r-wbbu - make a ctrl+O hotkey to show/hide tool output
- r-xf5l - bug: (regression) task ids are no longer linked
- r-g06q - take the font size and the padding down a notch in the task list
- r-0fat - Show task IDs in task list
- r-4evn - Chat is saying "Error: A request is already in progress"
- r-i7bh.3 - Improve task editor layout for more space
- r-i7bh.2 - Convert TaskDetailsDialog to use Sheet
- r-i7bh.1 - Create sheet UI component
- r-h1xs - rather than outputting `✨ Starting r-qmz bug: Now the task chat is hanging at "Waiting for response" and doesn't allow input` etc. I'd like for the starting a task and completing a task messages to be structured, so that we can format those responses differently in the event log.
- r-q8xo - the background for the progress bar should be a bit darker, it's currently hard to distinguish from the surrounding background
- r-i7bh - Bigger task editing UI
  We'll need more space for viewing and editing individual tasks. I think that UI should appear as a sheet that slides out from tasks and partly covers the event log.
- r-va2s - when I reload the UI, the event log shouldn't be cleared
- r-vzai - I'm still not seeing tasks grouped by epic
- r-5e7x - When I hover over a task, the card should appear directly over the task, so that the additional details above and below appear to enclose the task information that was  
  already visible.
- r-04t - in bash results, either use the color codes to color the output
- r-vbv - apply syntax highlighting to tool use results - diffs, bash results, etc
- r-1a3 - bug: each workspace should have its own ralph process and its own set of iterations and events. Currently when I switch to another workspace it's still showing me ralph running on the previous workspace
- r-4af - bug: when deleting I get
  Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  and the delete doesn't go through
- r-xmr - remove the "open details" button from the hover card
- r-jtb - warning in console:
  │ Vite hmr invalidate /src/components/tasks/TaskCard.tsx Could not Fast Refresh
  │ ("typeConfig" export is incompatible). Learn more at
- r-np7 - bug: the task chat still hangs on "Thinking..."
- r-67y - In the task sidebar, the ready/in progress/closed sections should shrink - there shouldn't be any white space between the sections
- r-qmz - bug: Now the task chat is hanging at "Waiting for response" and doesn't allow input
- r-8gr - bug: The delete task button doesn't work
- r-99i - regression: the task input is no longer regaining focus after a task has been entered
- r-arp - add hotkeys for rotating through workspaces: cmd+shift+[ and cmd+shift+]
- r-ujq - cmd+j should also focus the chat input - no need to have a separate hotkey for that
- r-eva - the task entry input should grow to accommodate the amount of text
- r-5pj - The iteration switcher should always be visible. It should display as a bar across the top of the event panel. Move the task currently being worked there.
- r-k3h - Remove "coming soon" from "stop after current task" entry in hotkeys reference
- r-pta - When I type anything into the task chat, I get "Error: A request is already in progress"
- r-k0c - move the task chat to the left of the issues list
- r-irj - the progress bar should use the number of closed tasks visible in the sidebar as the denominator - so if I change the past hour/past day/etc dropdown it should adjust accordingly
- r-aoa - when I try to use the task chat, it hangs on "Thinking..."
- r-y27 - get rid of the little pulsating dot in the upper right corner of the event log
- r-v17 - the task chat input should get focus after anything is submitted
- r-1m8 - In the issue dialog, don't show "feature" as a type. display bug/task/epic as a button bar
- r-d9w - Need a way to delete tasks in the issue dialog
- r-ikm - The progress bar should be in the highlight color
- r-69g - Error in comments section
- r-w2g.7 - Show child tasks and blockers in task dialog
- r-w2g.6 - Add click-to-edit description in task dialog
- r-w2g.5 - Add markdown rendering to task dialog
- r-w2g.4 - Add comments display to task dialog
- r-w2g.3 - Add labels support to task dialog
- r-w2g.2 - Add parent issue editing to task dialog
- r-w2g.1 - Add type selector to task dialog
- r-4wu - Fix flaky Tab key focus toggle test in App.test.tsx
- r-apy - omit the prefix from task ids, e.g. in this repo show `vyr` instead of `rui-vyr`
- r-ecy - Fixed sidebar headings with scrollable sections
- r-wqv - Task ID linking with decimal suffixes
- r-vyr - Show type and priority icons in task list
- r-h9h - Add find feature (Cmd+F)
- r-0iv - Current task not showing in status bar
- r-fh0 - Issue dialog should show child tasks and blockers
- r-d1x - Auto-expanding chat input
- r-91v - Collapsible code diffs
- r-ktc - Tasks in the sidebar should be ordered by priority, then create date
- r-42g - Spinner improvements: only include topology-star-_ icons (6 total, not topology-ring-_), and make it a tiny bit smaller
- r-xx6 - When Ralph adds a comment to a task, it shows up as being from Herb Caudill - should show 'Ralph'
- r-om9 - make the spinner a tiny bit smaller
- r-77v - cmd+enter in the issue dialog should save changes
- r-1ca - change those up arrows to just `arrow-up`
- r-eou - Task progress bar in sidebar
- r-lep - show a progress bar for the context window
- r-16a - we don't need the "auto-scroll" label
- r-uxz - even if a button is disabled (e.g. the start button when ralph is already running) it should show its tooltip so I know what it does and its hotkey
- r-hsr - clicking a task currently toggles displaying a line underneath it showing the type. we don't need any of that - clicking should just open the dialog
- r-w2g - Editable issue properties in dialog
- r-p0o - the sidebar width should be persisted
- r-2nn - in the status bar where we show the repo name, add the branch name as well
- r-hjx - refactor so that all utility functions are in their own file (one file, one function)
- r-2f0 - Change the icon for the add task button to an up arrow. use arrow-big-up-filled. (send message should use the same icon)
- r-cgf - after adding a task the task input should retain focus
- r-mrn - Show token counts in status bar
- r-a2r - Change the "Type a message..." placeholder to "Send Ralph a message..."
- r-44v - Change the "Add a task..." placeholder to "Tell Ralph what you want to do"
- r-g0q - Use an input group for messages to Ralph. The input should be a text area and should not have its own border. It should behave the same as the task input (enter submits, shift-enter adds a new line)
- r-83u - Auto-focus the task input. The tab key should just take me back and forth between the task input and the message input.
- r-3u4 - are we showing glob results? They always display like this:

Glob src/hooks/useTheme\*
└

with nothing attached

Glob src/hooks/useTheme\*
└

with nothing

- r-wbc - Get rid of the status bar that's currently above the event log. There's another status bar at the bottom of the screen, which I like. tuck that one into the right-hand panel, still at the bottom but not spanning across to the task panel on the left. and add the task currently being worked on to that status bar.
- r-96m - pausing ralph changes the state of the control buttons but events keep coming in
- r-06v - add a 2px border around the whole page in the accent color
- r-mjf - Make a favicon with the ralph logo
- r-1k3 - With the exception of the Ralph logo, use tabler icons instead of one-off svgs.
- r-6q8 - Persist state in local storage
- r-j2w - In the event log, when displaying paths, if they're in this repo show the path relative to the repo (so `packages/ui/src/components/ui/dialog.tsx` instead of `Users/herbcaudill/Code/HerbCaudill/ralph/packages/ui/src/components/ui/dialog.tsx`. I think you can do that by just calculating the full path of the repo once (in this case `Users/herbcaudill/Code/HerbCaudill/ralph/` , and just eliminating that from any part of the response
- r-eep - in the add task input, enter should submit and shift-enter should create a new line
- r-p5m - use the square-rounded-plus-filled icon for the add button
- r-443 - add a hotkey for changing theme
- r-azk - put the spinner to the left. Instead of the rotating disc, alternate between the 6 topology-\* icons in tabler icons, while spinning them
- r-alz - in the status bar show how long ralph has been running
- r-moz - for the send message button use an up arrow icon rather than the send icon
- r-8ze - add syntax highlighting for code
- r-4uq - cmd+/ opens up a list of hotkeys
- r-0kp - Add a command palette (hotkey cmd+;)
- r-48s - when task ids appear in the event log, make them links to edit that task
- r-t50 - Show hotkeys for any buttons on hover
- r-hob - show the closed tasks in the order that they were closed
- r-z4z - Put the control buttons in the status bar
- r-6kc - Show a spinner at the bottom of the event log as long as Ralph is running
- r-ea7 - move the status bar to the top of the right-hand panel. Add the name of the task currently being worked on
- r-z6m - persist the text in the task input to local storage as I type, so that it survives a reload
- r-0dh - Make the whole header the accent color with text reversed out
- r-zeg - Get rid of the "connected" indicator in the header since we already have one in the footer
- r-95i - The principal buttons (add task, send message) should be the accent color
- r-tux - in the task input area, the input should be a text area so I can input more than one line. The "add" button should be below the text area and should say "Add"
- r-7ts - get rid of padding in the right hand pane (containing events from ralph and the type a message panel)
- r-014 - Make a dialog for viewing task details and editing them
- r-26f - when hovering over a task, show a popup with more details. It should be positioned such that the symbol and the title text are in the exact same position as when not hovered. Above the title text put metadata like task number and priority. Below it put the description etc. This would also have a button to open the task details in a dialog.
- r-e7s - for the list of closed tasks, add a dropdown to the right of the 'Closed' label to choose between:
- past hour
- past day
- past week
- all time
- r-xjf - show the task count in the dropdown as well as the workspace label, but make it the count of open + in progress tasks
- r-7xj - show the play/pause/stop buttons
- r-7y5 - get rid of the button to hide/show the sidebar
- r-ged - get rid of the pathname under the workspace name in the dropdown
- r-egx - use the folder-filled icon for workspaces and color it according to the workspace's accent color - both when showing the selected one and in the dropdown (replacing the colored dots)
- r-8n4 - make the "add" button in the add task input group solid colored with the icon in white
- r-5cc - get rid of the caret for expanding tasks
- r-zeu - don't show the priority or task number in the sidebar, just the task
- r-17z - the add task input should stay focused after a task is submitted
- r-zex - get rid of the internal padding in the sidebar
- r-fwl - fix the act() test warnings
- r-9m2 - tighten up the leading on assistant text
- r-4n6 - the status bar and the 'Start Ralph to send messages' placeholder are flickering around once a second
- r-rk9 - put assistant text in font-serif
- r-2pl - Support pausing via stdin
- r-mky - Prepend '# Ralph, round X' to each prompt
- r-r53 - Restyle task input as borderless shadcn input group with add button
- r-m23 - Remove tasks heading
- r-pfv - Group tasks by epic within each status
- r-z8b - Hide collapse/expand UI for epics with no subtasks
- r-3ly - Start Ralph in watch mode on workspace switch
- r-lem - Make sidebar resizable
- r-4p3 - Add stop-after-current support
- r-fsd - Add pause support
- r-7xe - Group tasks by epic in sidebar
- r-lj0 - Set up Storybook for component documentation
- r-8y8 - Make task status headings collapsible
- r-w9f - Add light/dark mode support
- r-dco - Pick up accent color from peacock settings
- r-a2g - Add keyboard hotkeys for all actions
- r-1h4 - number the event logs sequentially rather than overwriting the previous one
- r-dvw - format the event log as jsonl
- r-hhl - set the default iterations to 120% of the number of open issues
- r-zi3 - Implement stop-after-current iteration
- r-loy - Accept stdin commands while running
- r-y41 - Add --json flag for structured event output
- r-4rt.6 - Create WorkspacePicker component
- r-4rt.5 - Create TaskCard component
- r-4rt.4 - Create TaskList component
- r-4rt.3 - Create QuickTaskInput component
- r-4rt.2 - Create TaskSidebar component
- r-4rt.1 - Create BdProxy class
- r-1ey.2 - Wire up message sending
- r-1ey.1 - Create ChatInput component
- r-29h.4 - Create ControlBar component
- r-29h.3 - Create TextBlock component
- r-29h.2 - Create ToolUseCard component
- r-29h.1 - Create EventStream component
- r-9dq.6 - Create StatusBar component
- r-9dq.5 - Create Header component
- r-9dq.4 - Create main layout component
- r-9dq.3 - Set up Zustand store
- r-9dq.2 - Create WebSocket client hook
- r-9dq.1 - Set up Vite + React + Tailwind + shadcn/ui
- r-lo2.4 - Create REST API endpoints
- r-lo2.3 - Implement WebSocket event broadcast
- r-lo2.2 - Create RalphManager class
- r-lo2.1 - Set up Express server with WebSocket support
- r-4rt - Task management
- r-1ey - Agent chat
- r-29h - Agent monitoring
- r-9dq - React shell
- r-lo2 - Server foundation
- r-b3v - since we're already listening for new issues, can we increment the number of tasks remaining by one when an issue is created?
- r-c7l - check the number of tasks available before starting a round - if it's zero, go straight to waiting. (we already look this number up for the progress bar)
- r-137 - move the dots spinner after 'Waiting for new issues' and get rid of the three dots from the text
- r-tdg - the borders above and below the input should occupy the full width of the terminal
- r-z4a - what happened to the spinner when waiting?
- r-b1u - show the current repo name (e.g. 'ralph' or 'translate') in the status bar next to the progress bar
- r-9kb - Instead of a box for the input, format it like Claude Code's input: a gray border above and below, and '❯ ' as a prompt
- r-a92 - Don't show the input while waiting for new issues
- r-fqg - Change the placeholder to 'send a message to Ralph'
- r-91p - lose the emoji on the user input. don't show a confirmation of my message, just show it in the stream.
- r-dh9 - always show an input for user messages. format it like a box just above the footer. get rid of the esc hotkey
- r-6bv - rename templates/prompt.md to prompt-todos.md and update all references including in the readme
- r-766.3 - Consider alternative user message injection approach
- r-3n9 - when I send a message to the assistant, it should show up in the stream
- r-0sn - ctrl-m doesn't seem to be working. let's use the escape key instead
- r-6zk - ctrl-m doesn't seem to be working
- r-6xd - this is a test
- r-pr5 - In watch mode, 'Waiting for new issues...' should be blue like the normal status line, but it should use the simple-dots-scrolling spinner
- r-b7r - if there is no prompt.md, use the appropriate prompt from /templates
- r-9w9 - leave the replay flag out of the readme, it's just there for debugging
- r-fwp - confirm that the readme is still consistent with the code - for example it currently says the default is 10 iteratiuons
- r-dqg - rename AGENTS.md to CLAUDE.md and update any references
- r-dir - in the readme under Quick start properly indent the instructions for each step
- r-1tc - document watch mode in the readme
- r-ufe - update the readme to give examples with bd
- r-jwk.5 - Display user-injected messages in the output stream
- r-jwk.4 - Wire up user input to SDK streamInput
- r-jwk.3 - Add UI for capturing user input while Claude is running
- r-jwk.2 - Research SDK streamInput API for runtime user messages
- r-vvq - clear the screen on startup
- r-jwk - Give me a way to give input to Claude Code while it's working
- r-yxg - in watch mode, increment the round number when picking up a new issue
- r-gzc - change the default max to 50
- r-a8m - add an ascii art RALPH heading to the readme, matching the text style produced by the cli
- r-6eo - remove the haiku from the readme
- r-7wo - Translate the haiku to Japanese
- r-uob - Add a haiku to the README
- r-02t - translate the haiku to japanese
- r-ej0 - add a haiku to the readme
- r-bnare.3 - Document .ralph/state.latest.json in CLAUDE.md for debugging
- r-bnare.2 - Add UI hook to export and POST state to server on session transitions in dev mode
- r-bnare.1 - Add server endpoint to write state to .ralph/state.latest.json
- r-tufi7.52.5 - Clean up store and ralphConnection 'as any' subtype/event casts
- r-tufi7.52.4 - Remove unsafe casts in hooks and lib utilities (useStreamingState, buildToolResultsMap, useSessionPersistence)
- r-tufi7.52.3 - Remove unsafe casts in EventStreamEventItem.tsx component
- r-tufi7.52.2 - Convert event type guards to proper type predicates without 'as any'
- r-tufi7.52.1 - Define discriminated union types for ChatEvent shapes
- r-tufi7.51.5 - Add backward compatibility for legacy task-chat:\* wire message types
- r-tufi7.51.4 - Merge reconnection logic into single mechanism with timestamp tracking
- r-tufi7.51.3 - Unify client-side event handlers in ralphConnection.ts
- r-tufi7.51.2 - Consolidate server broadcast paths for Ralph and Task Chat events
- r-tufi7.51.1 - Define unified agent:event wire message envelope type
- r-ac882.4 - Add expiration/cleanup for stale comment drafts
- r-vvmgm - Fix workspaces dropdown: non-selected items should not have white text
- r-sdmmm - Adjust 'scroll to latest' button position in task chat to be 30px higher
- r-bnare - Add periodic state export to .ralph/state.latest.json in dev mode
- r-8cixo - Omit 'Ralph dev server running' warning during Playwright tests
- r-tufi7.42.5 - Update tests for viewingSessionId migration
- r-tufi7.42.4 - Update persistence layer for viewingSessionId
- r-tufi7.42.3 - Update UI components and hooks to use viewingSessionId
- r-tufi7.42.2 - Replace viewingSessionIndex with viewingSessionId in store state, actions, and selectors
- r-tufi7.42.1 - Add getSessionId helper to map session boundaries to stable IDs
- r-tufi7.23.3 - Add tests for orphaned session cleanup
- r-tufi7.23.2 - Call cleanup on database initialization
- r-tufi7.23.1 - Add cleanupOrphanedSessions method to EventDatabase
- r-9nmnz - Move event stream bottom padding from spinner to container
- r-pugy6 - Use gray circle icon for open tasks
- r-q00fx - truncated description at colons in code blocks
- r-tufi7.53 - useTaskChatPersistence and useStoreHydration have circular dependency on session ID
- r-tufi7.52 - Loose event type checking with 'as any' casts
- r-tufi7.51 - Ralph events and task chat events use different WebSocket event schemas
- r-tufi7.48 - Event index tracking assumes single instance
- r-tufi7.47 - Server per-client event tracking not used for welcome message
- r-tufi7.44 - Task chat events use separate batching with module-level state
- r-tufi7.43 - Task chat events not scoped to instance
- r-tufi7.42 - viewingSessionIndex uses array index instead of stable session ID
- r-tufi7.38 - wasRunningBeforeDisconnect flag can cause incorrect auto-resume
- r-tufi7.35 - currentSessionIds map not synced with IndexedDB state
- r-tufi7.33 - Ralph session vs task chat session: both use 'events' table with overlapping sessionId prefix
- r-tufi7.28 - Tool results map computed in multiple places
- r-tufi7.23 - Orphaned sessions not cleaned up when filtered
- r-tufi7.21 - wasRunningBeforeDisconnect flag can become stale across tab visibility changes
- r-tufi7.19 - Legacy flat fields duplicate instance state
- r-tufi7.17 - Session ID generation is fragmented across multiple files
- r-tufi7.16 - Duplicated type guards across packages
- r-tufi7.15 - IndexedDB persistence in ralphConnection duplicates React hook functionality
- r-tufi7.14 - Task chat and Ralph sessions share events table but with different ID schemes
- r-biuk - Make connection indicator white in header
- r-2xka - Focus chat input after clearing history
- r-z6b7.12 - Add url-routing.spec.ts
- r-z6b7.11 - Add Storybook interaction tests for ThemePicker
- r-z6b7.10 - Add Storybook interaction tests for HotkeysDialog
- r-z6b7.9 - Add Storybook interaction tests for CommandPalette
- r-z6b7.8 - Add chat.spec.ts
- r-z6b7.7 - Add event-stream.spec.ts
- r-z6b7.6 - Add Storybook interaction tests for TaskDetailsDialog
- r-z6b7.5 - Add Storybook interaction tests for TaskSidebar
- r-z6b7.4 - Add Storybook interaction tests for ControlBar
- r-z6b7.3 - Add navigation.spec.ts
- r-z6b7.2 - Add layout.spec.ts
- r-z6b7.1 - Create page objects and test fixtures
- r-z6b7 - UI Test Coverage (E2E + Storybook)
- r-cxn - ThemePicker component
- r-5w0 - useVSCodeTheme hook
- r-zoa - Update components to use status colors
- r-el8 - Add status color CSS variables
- r-0j6 - Markdown code block integration
- r-28p - CodeBlock component
- r-4tm - Shiki highlighter setup
- r-i3g - Theme color mapper
- r-nrh - Theme parser
- r-tzz - Theme types
- r-obb - Theme API endpoints
- r-w8p - ThemeDiscovery class - scan VS Code extensions
- r-bnb - VS Code theme support
- r-ozo - Fix failing TaskSidebar test (does not render quickInput area)
- r-7bu - Wire up quick task input focus hotkey (Cmd+K)
- r-tufi7.27 - Unused useWebSocket hook creates maintenance burden
- r-gok7 - Multi-agent support
- r-bklw - Update eventToBlocks for normalized events
- r-mlql - Create adapter registry and factory
- r-8a04 - Create ClaudeAdapter
