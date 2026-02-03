import { useCallback } from "react"
import { MainLayout } from "./components/MainLayout"
import { RalphRunner } from "./components/RalphRunner"
import { TaskChatPanel } from "./components/TaskChatPanel"
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
 * Layout: (1) task chat (left), (2) tasks (center), (3) ralph loop (right)
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
  const { error: tasksError } = useTasks()
  const { selectedTask, openDialogById, closeDialog } = useTaskDialog()

  // Handle task click from sidebar
  const handleTaskClick = useCallback(
    (taskId: string) => {
      openDialogById(taskId)
    },
    [openDialogById],
  )

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

  // Handle task chat message send (placeholder - will be connected to task-specific chat)
  const handleTaskChatSend = useCallback((_message: string) => {
    // TODO: Connect to task-specific chat functionality
  }, [])

  // Task chat panel (left side)
  const sidebar = (
    <TaskChatPanel
      taskId={selectedTask?.id ?? null}
      taskTitle={selectedTask?.title}
      events={[]} // TODO: Connect to task-specific chat events
      isStreaming={false}
      onSendMessage={handleTaskChatSend}
      onClose={closeDialog}
    />
  )

  // Ralph loop panel (right side)
  const rightPanel = (
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
  )

  return (
    <div className="flex h-screen flex-col">
      <MainLayout sidebar={sidebar} rightPanel={rightPanel}>
        {/* Tasks panel (center) */}
        <TaskSidebarController onTaskClick={handleTaskClick} onOpenTask={handleTaskClick} />
      </MainLayout>
      <StatusBar connectionStatus={connectionStatus} events={events} error={tasksError} />
    </div>
  )
}
