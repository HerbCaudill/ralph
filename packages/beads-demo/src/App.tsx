import { useCallback, useEffect, useRef, useState } from "react"
import {
  BeadsViewProvider,
  DEFAULT_ACCENT_COLOR,
  TaskPanelController,
  useTasks,
  useTaskDialog,
  useTaskNavigation,
  useTaskMutations,
  useBeadsHotkeys,
  useBeadsViewStore,
  useWorkspace,
  selectSelectedTaskId,
  selectTasks,
  selectClosedTimeFilter,
  WorkspaceSelector,
  QuickTaskInput,
  type SearchInputHandle,
  type QuickTaskInputHandle,
} from "@herbcaudill/beads-view"
import { DemoShell } from "./components/DemoShell"
import { TaskDetailPanel } from "./components/TaskDetailPanel"
import { TaskStatusBar } from "./components/TaskStatusBar"
import { HotkeysDialog } from "./components/HotkeysDialog"

export function App() {
  return (
    <BeadsViewProvider>
      <AppContent />
    </BeadsViewProvider>
  )
}

function AppContent() {
  const clearTasks = useBeadsViewStore(state => state.clearTasks)
  const { state: ws, actions: wsActions } = useWorkspace({ onSwitchStart: clearTasks })
  const { isLoading, error, refresh } = useTasks({ all: true })

  // Real-time task refresh via WebSocket
  useTaskMutations({ workspacePath: ws.current?.path })

  // Apply workspace accent color as CSS custom property
  useEffect(() => {
    const color = ws.current?.accentColor ?? DEFAULT_ACCENT_COLOR
    document.documentElement.style.setProperty("--accent-color", color)

    return () => {
      document.documentElement.style.removeProperty("--accent-color")
    }
  }, [ws.current?.accentColor])
  const dialog = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  // Store state for task navigation
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)

  // Store state for progress bar
  const tasks = useBeadsViewStore(selectTasks)
  const closedTimeFilter = useBeadsViewStore(selectClosedTimeFilter)

  // Refs for input focus
  const searchInputRef = useRef<SearchInputHandle>(null)
  const taskInputRef = useRef<QuickTaskInputHandle>(null)

  // Hotkeys dialog state
  const [hotkeysDialogOpen, setHotkeysDialogOpen] = useState(false)

  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      void dialog.openDialogById(taskId)
    },
    [dialog, setSelectedTaskId],
  )

  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null)
    dialog.closeDialog()
  }, [dialog, setSelectedTaskId])

  const handleChanged = useCallback(() => {
    void refresh()
  }, [refresh])

  // Hotkey handlers
  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus()
  }, [])

  const handleFocusTaskInput = useCallback(() => {
    taskInputRef.current?.focus()
  }, [])

  // Task navigation with auto-open on arrow key navigation
  const { navigatePrevious, navigateNext, openSelected } = useTaskNavigation({
    onOpenTask: handleTaskClick,
  })

  const handleShowHotkeys = useCallback(() => {
    setHotkeysDialogOpen(true)
  }, [])

  // Register hotkeys
  const { registeredHotkeys } = useBeadsHotkeys({
    handlers: {
      focusSearch: handleFocusSearch,
      focusTaskInput: handleFocusTaskInput,
      previousTask: navigatePrevious,
      nextTask: navigateNext,
      openTask: openSelected,
      showHotkeys: handleShowHotkeys,
    },
  })

  return (
    <>
      <DemoShell
        title="Beads Task Manager Demo"
        headerActions={
          <WorkspaceSelector
            current={ws.current}
            workspaces={ws.workspaces}
            isLoading={ws.isLoading}
            onSwitch={wsActions.switchWorkspace}
          />
        }
        sidebar={
          <TaskPanelController
            searchInputRef={searchInputRef}
            onTaskClick={handleTaskClick}
            onOpenTask={handleTaskClick}
            isLoadingExternal={ws.isLoading}
          />
        }
        sidebarWidth={340}
        statusBar={
          <TaskStatusBar
            workspace={ws.current}
            isLoading={isLoading}
            error={error}
            isRunning={!error && !isLoading}
            tasks={tasks}
            initialTaskCount={tasks.length > 0 ? tasks.length : null}
            accentColor={ws.current?.accentColor ?? null}
            closedTimeFilter={closedTimeFilter}
          />
        }
      >
        {selectedTaskId !== null ?
          <TaskDetailPanel
            task={dialog.selectedTask}
            open={selectedTaskId !== null}
            onClose={handleCloseDetail}
            onChanged={handleChanged}
          />
        : <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-md">
              <QuickTaskInput ref={taskInputRef} onTaskCreated={refresh} />
            </div>
          </div>
        }
      </DemoShell>
      <HotkeysDialog
        open={hotkeysDialogOpen}
        onClose={() => setHotkeysDialogOpen(false)}
        hotkeys={registeredHotkeys}
      />
    </>
  )
}
