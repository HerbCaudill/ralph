# 022: Restore Old UI Features

## Goal

Restore feature parity with the old Ralph UI by copying components from git history (`4e931633^:packages/ui-deprecated/`) and wiring them into the new architecture.

## Source Reference

```bash
# View any old component:
git show 4e931633^:packages/ui-deprecated/src/components/layout/StatusBar.tsx

# List all old components:
git ls-tree -r --name-only 4e931633^ -- packages/ui-deprecated/src/components/
```

---

## Tasks

### 1. Restore Header HelpButton

**Goal:** Add the ? button to header that opens hotkeys dialog

**Copy from git:**

- `packages/ui-deprecated/src/components/layout/HelpButton.tsx`
- `packages/ui-deprecated/src/components/layout/tests/HelpButton.test.tsx`

**Modify:**

- `packages/ui/src/components/layout/Header.tsx` - Add HelpButton between workspace selector and settings

**Old component structure:**

```tsx
// HelpButton.tsx - uses IconHelp, calls openHotkeysDialog from store
<Button onClick={openHotkeysDialog} title="Keyboard shortcuts">
  <IconHelp className="size-5" />
</Button>
```

**Verification:**

- Click ? opens HotkeysDialog
- Cmd+/ also opens it (already works)

---

### 2. Restore Full ControlBar

**Goal:** Replace current AgentControls with full ControlBar (start/pause/stop/stop-after-current)

**Copy from git:**

- `packages/ui-deprecated/src/components/controls/ControlBar.tsx`
- `packages/ui-deprecated/src/components/controls/tests/ControlBar.test.tsx`
- `packages/ui-deprecated/src/lib/getControlBarButtonStates.ts`
- `packages/ui-deprecated/src/lib/startRalph.ts`
- `packages/ui-deprecated/src/lib/stopRalph.ts`
- `packages/ui-deprecated/src/lib/pauseRalph.ts`
- `packages/ui-deprecated/src/lib/resumeRalph.ts`
- `packages/ui-deprecated/src/lib/stopAfterCurrentRalph.ts`
- `packages/ui-deprecated/src/lib/cancelStopAfterCurrentRalph.ts`

**Modify:**

- `packages/ui/src/components/StatusBar.tsx` - Use ControlBar instead of AgentControls

**Old component features:**

- Start button (play icon) - starts new Ralph session
- Pause/Resume button - toggles pause state
- Stop button - stops immediately
- Stop-after-current button - stops after current task completes
- Tooltips with hotkey hints
- Button states disabled based on Ralph status

**Verification:**

- All four buttons visible in footer
- Start works when idle
- Pause/Resume toggles correctly
- Stop stops immediately
- Stop-after-current queues stop

---

### 3. Restore StatusIndicator

**Goal:** Show running/paused/idle text in footer

**Copy from git:**

- `packages/ui-deprecated/src/components/layout/StatusIndicator.tsx`

**Old component:**

```tsx
// Shows "Running", "Paused", "Idle" etc with colored dot
<span className="flex items-center gap-1.5">
  <span className={cn("size-2 rounded-full", statusColor)} />
  <span>{statusText}</span>
</span>
```

**Modify:**

- `packages/ui/src/components/StatusBar.tsx` - Add StatusIndicator after ControlBar

---

### 4. Restore RunDuration (Session Timer)

**Goal:** Show elapsed session time in footer

**Copy from git:**

- `packages/ui-deprecated/src/components/layout/RunDuration.tsx`
- `packages/ui-deprecated/src/components/layout/tests/RunDuration.test.tsx`

**Note:** Current `useSessionTimer` hook exists in `packages/ui/src/hooks/useSessionTimer.ts`. Verify compatibility.

**Old component:**

```tsx
// Shows "1:04" format, only when > 00:00
<span className="font-mono text-xs">{formatted}</span>
```

**Verification:**

- Timer shows elapsed time during Ralph session
- Timer resets on new session

---

### 5. Restore RepoBranch

**Goal:** Show workspace name and git branch in footer

**Copy from git:**

- `packages/ui-deprecated/src/components/layout/RepoBranch.tsx`

**Old component:**

```tsx
// Shows "ralph / main" with icons
<span className="flex items-center gap-1.5">
  <IconFolder size={14} />
  <span>{workspaceName}</span>
  <span className="text-muted-foreground">/</span>
  <IconGitBranch size={14} />
  <span>{branch}</span>
</span>
```

**Note:** Current StatusBar already has this logic inline. May just need styling adjustments.

---

### 6. Restore SessionProgress (Task Progress Bar)

**Goal:** Show task completion progress in footer

**Copy from git:**

- `packages/ui-deprecated/src/components/layout/SessionProgress.tsx`

**Note:** `TaskProgressBar` exists in `packages/beads-view/src/components/tasks/TaskProgressBar.tsx`. Evaluate which to use.

**Old component:**

```tsx
// Shows progress bar with "3/10" count
<div className="flex items-center gap-2">
  <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
    <div className="h-full bg-repo-accent" style={{ width: `${progress}%` }} />
  </div>
  <span className="text-xs">
    {current}/{total}
  </span>
</div>
```

**Verification:**

- Progress bar visible when Ralph is running
- Updates as tasks are completed

---

### 7. Restructure StatusBar Layout

**Goal:** Rebuild StatusBar to match old layout structure

**Old StatusBar structure (left to right):**

```
[ControlBar] [StatusIndicator] [RunDuration] | [RepoBranch] [TokenUsage] [ContextWindow] [SessionProgress]
```

**Current StatusBar has:** Connection indicator, some controls, workspace, token usage, context window

**Modify:**

- `packages/ui/src/components/StatusBar.tsx` - Restructure to use restored components

---

### 8. Task Details as Sheet Overlay

**Goal:** Task details should open as overlay/sheet from right, not replace left sidebar

**Create new:**

- `packages/ui/src/components/TaskDetailSheet.tsx` - Wraps TaskDetailsController in Sheet

**Modify:**

- `packages/ui/src/App.tsx`:
  - Remove conditional sidebar logic (always show TaskChatPanel)
  - Add Sheet component that opens when task is selected
  - Sheet slides in from right over Ralph panel

**Reference:** `packages/ui/src/components/ui/sheet.tsx` already exists

**Structure:**

```tsx
// App.tsx
const sidebar = <TaskChatPanel ... />  // Always task chat

// Sheet overlay for task details
<Sheet open={selectedTaskId !== null} onOpenChange={...}>
  <SheetContent side="right">
    <TaskDetailsController task={selectedTask} ... />
  </SheetContent>
</Sheet>
```

**Verification:**

- Left panel always shows TaskChatPanel
- Clicking task opens sheet from right
- Sheet can be closed
- Sheet doesn't replace any panel

---

### 9. Wire TaskProgressBar to Task List

**Goal:** Show task completion progress below task list

**Component exists:** `packages/beads-view/src/components/tasks/TaskProgressBar.tsx`

**Modify:**

- Either export TaskProgressBar from beads-view and use in App.tsx
- Or add it inside TaskSidebarController

**Props needed:**

- `isRunning` - from useRalphLoop().controlState === "running"
- `tasks` - from useTasks()
- `accentColor` - from workspace

---

### 10. Wire Theme Picker

**Goal:** Enable VS Code theme selection

**Components exist:**

- `packages/ui/src/components/layout/ThemePicker.tsx`
- `packages/beads-server/src/ThemeDiscovery.ts`

**Create:**

- `/api/themes` endpoint in beads-server
- `useThemes` hook to fetch available themes

**Modify:**

- `packages/ui/src/components/layout/SettingsDropdown.tsx` - Add ThemePicker

**Copy from git (if needed):**

- `packages/ui-deprecated/src/components/layout/ThemePickerController.tsx`
- `packages/ui-deprecated/src/hooks/useTheme.ts`
- `packages/ui-deprecated/src/hooks/useThemeCoordinator.ts`

---

### 11. Copy and Update Tests

**Copy tests for all restored components:**

From `packages/ui-deprecated/src/components/`:

- `layout/tests/Header.test.tsx`
- `layout/tests/StatusBar.test.tsx`
- `layout/tests/HelpButton.test.tsx`
- `layout/tests/RunDuration.test.tsx`
- `layout/tests/ThemePicker.test.tsx`
- `controls/tests/ControlBar.test.tsx`

**Update imports** to match new package structure.

---

## Implementation Order

1. Task 1: HelpButton (quick win, header)
2. Task 2: ControlBar (core functionality)
3. Task 3: StatusIndicator
4. Task 4: RunDuration
5. Task 5: RepoBranch
6. Task 6: SessionProgress
7. Task 7: StatusBar restructure (combines above)
8. Task 8: Task details as sheet
9. Task 9: TaskProgressBar wiring
10. Task 10: Theme picker wiring
11. Task 11: Tests

---

## Verification

After all tasks complete:

1. `pnpm typecheck` - No errors
2. `pnpm ui:test` - All tests pass
3. Manual verification:
   - Header: Logo, workspace selector, ?, settings
   - Footer: Start/Pause/Stop buttons, "Running"/"Idle" text, timer, repo/branch, tokens, context window, progress
   - Left panel: Always TaskChatPanel
   - Task click: Opens sheet from right
   - Progress bar under task list when running
   - Theme picker in settings works
