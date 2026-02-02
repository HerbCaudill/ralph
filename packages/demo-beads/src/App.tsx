import { useCallback, useState } from "react"
import {
  BeadsViewProvider,
  TaskSidebarController,
  useTasks,
  useTaskDialog,
} from "@herbcaudill/beads-view"
import { DemoShell } from "./components/DemoShell"
import { WorkspaceSelector } from "./components/WorkspaceSelector"
import { TaskDetailPanel } from "./components/TaskDetailPanel"
import { TaskStatusBar } from "./components/TaskStatusBar"
import { useWorkspace } from "./hooks/useWorkspace"

export function App() {
  return (
    <BeadsViewProvider>
      <AppContent />
    </BeadsViewProvider>
  )
}

function AppContent() {
  const { state: ws, actions: wsActions } = useWorkspace()
  const { tasks, isLoading, error, refresh } = useTasks({ all: true })
  const dialog = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      void dialog.openDialogById(taskId)
    },
    [dialog],
  )

  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null)
    dialog.closeDialog()
  }, [dialog])

  const handleChanged = useCallback(() => {
    void refresh()
  }, [refresh])

  return (
    <DemoShell
      title="Beads Task Manager Demo"
      subtitle="Task management UI"
      headerActions={
        <WorkspaceSelector
          current={ws.current}
          workspaces={ws.workspaces}
          isLoading={ws.isLoading}
          onSwitch={wsActions.switchWorkspace}
        />
      }
      sidebar={<TaskSidebarController onTaskClick={handleTaskClick} onOpenTask={handleTaskClick} />}
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
  )
}
