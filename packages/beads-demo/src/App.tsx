import { useCallback, useRef, useState } from "react"
import {
  BeadsViewProvider,
  TaskSidebarController,
  useTasks,
  useTaskDialog,
  useBeadsHotkeys,
  useBeadsViewStore,
  selectSelectedTaskId,
  selectVisibleTaskIds,
  type SearchInputHandle,
} from "@herbcaudill/beads-view"
import { DemoShell } from "./components/DemoShell"
import { WorkspaceSelector } from "./components/WorkspaceSelector"
import { TaskDetailPanel } from "./components/TaskDetailPanel"
import { TaskStatusBar } from "./components/TaskStatusBar"
import { HotkeysDialog } from "./components/HotkeysDialog"
import { useWorkspace } from "./hooks/useWorkspace"

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
  const { tasks, isLoading, error, refresh } = useTasks({ all: true })
  const dialog = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  // Store state for task navigation
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)
  const visibleTaskIds = useBeadsViewStore(selectVisibleTaskIds)

  // Ref for search input focus
  const searchInputRef = useRef<SearchInputHandle>(null)

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

  const handlePreviousTask = useCallback(() => {
    if (visibleTaskIds.length === 0) return
    const currentIndex =
      selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : visibleTaskIds.length
    const prevIndex = Math.max(currentIndex - 1, 0)
    const prevId = visibleTaskIds[prevIndex]
    if (prevId) setSelectedTaskId(prevId)
  }, [selectedTaskId, visibleTaskIds, setSelectedTaskId])

  const handleNextTask = useCallback(() => {
    if (visibleTaskIds.length === 0) return
    const currentIndex = selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : -1
    const nextIndex = Math.min(currentIndex + 1, visibleTaskIds.length - 1)
    const nextId = visibleTaskIds[nextIndex]
    if (nextId) setSelectedTaskId(nextId)
  }, [selectedTaskId, visibleTaskIds, setSelectedTaskId])

  const handleOpenTask = useCallback(() => {
    if (selectedTaskId) {
      void dialog.openDialogById(selectedTaskId)
    }
  }, [selectedTaskId, dialog])

  const handleShowHotkeys = useCallback(() => {
    setHotkeysDialogOpen(true)
  }, [])

  // Register hotkeys
  const { registeredHotkeys } = useBeadsHotkeys({
    handlers: {
      focusSearch: handleFocusSearch,
      focusTaskInput: handleFocusSearch,
      previousTask: handlePreviousTask,
      nextTask: handleNextTask,
      openTask: handleOpenTask,
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
          <TaskSidebarController
            searchInputRef={searchInputRef}
            onTaskClick={handleTaskClick}
            onOpenTask={handleTaskClick}
            isLoadingExternal={ws.isLoading}
          />
        }
        sidebarWidth={340}
        statusBar={
          <TaskStatusBar workspace={ws.current} tasks={tasks} isLoading={isLoading} error={error} />
        }
      >
        <TaskDetailPanel
          task={dialog.selectedTask}
          open={selectedTaskId !== null}
          onClose={handleCloseDetail}
          onChanged={handleChanged}
        />
      </DemoShell>
      <HotkeysDialog
        open={hotkeysDialogOpen}
        onClose={() => setHotkeysDialogOpen(false)}
        hotkeys={registeredHotkeys}
      />
    </>
  )
}
