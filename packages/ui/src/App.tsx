import { useCallback } from "react"
import { MainLayout } from "./components/MainLayout"
import { RalphRunner } from "./components/RalphRunner"
import { TaskDetailPanel } from "./components/TaskDetailPanel"
import { StatusBar } from "./components/StatusBar"
import { useRalphLoop } from "./hooks/useRalphLoop"
import {
  TaskSidebarController,
  BeadsViewProvider,
  configureApiClient,
  useTasks,
  useTaskDialog,
} from "@herbcaudill/beads-view"

// Configure API client for beads-view
configureApiClient({ baseUrl: "" }) // Uses relative URLs, proxied by Vite

/**
 * Main Ralph UI application.
 * Composes the task sidebar, Ralph runner, and task detail panel.
 */
export function App() {
  return (
    <BeadsViewProvider>
      <AppContent />
    </BeadsViewProvider>
  )
}

/** Inner component that uses beads-view hooks (requires BeadsViewProvider). */
function AppContent() {
  // Ralph loop state from SharedWorker
  const {
    events,
    isStreaming,
    controlState,
    connectionStatus,
    start,
    pause,
    resume,
    stop,
    sendMessage,
  } = useRalphLoop()

  // Task state from beads-view
  const { error: tasksError, refresh: refreshTasks } = useTasks()
  const { selectedTask, isOpen, openDialogById, closeDialog } = useTaskDialog()

  // Handle task click from sidebar
  const handleTaskClick = useCallback(
    (taskId: string) => {
      openDialogById(taskId)
    },
    [openDialogById],
  )

  // Handle task changes (save/delete)
  const handleTaskChanged = useCallback(() => {
    void refreshTasks()
  }, [refreshTasks])

  // Handle Ralph message send
  const handleRalphSend = useCallback(
    (message: string) => {
      sendMessage(message)
    },
    [sendMessage],
  )

  // Handle new session
  const handleNewSession = useCallback(() => {
    stop()
    // After stopping, starting will create a new session
    setTimeout(start, 100)
  }, [stop, start])

  // Task sidebar
  const sidebar = (
    <TaskSidebarController onTaskClick={handleTaskClick} onOpenTask={handleTaskClick} />
  )

  // Task detail panel (right side, shows task details when selected)
  const rightPanel = (
    <TaskDetailPanel
      task={selectedTask}
      open={isOpen}
      onClose={closeDialog}
      onChanged={handleTaskChanged}
    />
  )

  return (
    <div className="flex h-screen flex-col">
      <MainLayout sidebar={sidebar} rightPanel={rightPanel}>
        <RalphRunner
          events={events}
          isStreaming={isStreaming}
          controlState={controlState}
          onSendMessage={handleRalphSend}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onNewSession={handleNewSession}
        />
      </MainLayout>
      <StatusBar connectionStatus={connectionStatus} events={events} error={tasksError} />
    </div>
  )
}
