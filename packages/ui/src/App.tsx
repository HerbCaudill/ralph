import { useState, useCallback } from "react"
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
import type { ChatEvent } from "@herbcaudill/agent-view"

// Configure API client for beads-view
configureApiClient({ baseUrl: "" }) // Uses relative URLs, proxied by Vite

/**
 * Main Ralph UI application.
 * Composes the task sidebar, Ralph runner, and task chat panel.
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
  const { selectedTask, isOpen, openDialogById, closeDialog } = useTaskDialog()

  // Task chat state (separate from Ralph session)
  const [taskChatEvents, setTaskChatEvents] = useState<ChatEvent[]>([])
  const [taskChatStreaming, setTaskChatStreaming] = useState(false)

  // Handle task click from sidebar
  const handleTaskClick = useCallback(
    (taskId: string) => {
      openDialogById(taskId)
    },
    [openDialogById],
  )

  // Handle task chat message send (placeholder - would connect to agent-server)
  const handleTaskChatSend = useCallback((message: string) => {
    console.log("Task chat message:", message)
    // TODO: Connect to agent-server with task-chat app namespace
    setTaskChatStreaming(true)
    setTaskChatEvents(prev => [
      ...prev,
      {
        type: "user",
        uuid: crypto.randomUUID(),
        timestamp: Date.now(),
        message: { role: "user", content: message },
      } as ChatEvent,
    ])
    setTimeout(() => setTaskChatStreaming(false), 1000)
  }, [])

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

  // Task chat panel (right side, only when task selected)
  const rightPanel =
    isOpen && selectedTask ?
      <TaskChatPanel
        taskId={selectedTask.id}
        taskTitle={selectedTask.title}
        events={taskChatEvents}
        isStreaming={taskChatStreaming}
        onSendMessage={handleTaskChatSend}
        onClose={closeDialog}
      />
    : null

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
