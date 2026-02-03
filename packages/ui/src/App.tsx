import { useCallback, useRef } from "react"
import { MainLayout } from "./components/MainLayout"
import { Header } from "./components/layout"
import { RalphRunner } from "./components/RalphRunner"
import { TaskChatPanel } from "./components/TaskChatPanel"
import { TaskDetailPanel } from "./components/TaskDetailPanel"
import { StatusBar } from "./components/StatusBar"
import { useRalphLoop } from "./hooks/useRalphLoop"
import { useAccentColor } from "./hooks/useAccentColor"
import { useTaskChat } from "./hooks/useTaskChat"
import { useCurrentTask } from "./hooks/useCurrentTask"
import { useUiStore } from "./stores/uiStore"
import {
  TaskSidebarController,
  BeadsViewProvider,
  configureApiClient,
  useTasks,
  useTaskDialog,
  useBeadsViewStore,
  selectSelectedTaskId,
  selectVisibleTaskIds,
  useWorkspace,
  useBeadsHotkeys,
  type SearchInputHandle,
} from "@herbcaudill/beads-view"
import { useAgentHotkeys, type ChatInputHandle } from "@herbcaudill/agent-view"

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

  // Task chat state from agent-server
  const { state: taskChatState, actions: taskChatActions } = useTaskChat()

  // Current task from Ralph events
  const { taskId: currentTaskId, taskTitle: currentTaskTitle } = useCurrentTask(events)

  // Workspace state from beads-view
  const {
    state: { current: workspace, workspaces, isLoading: isWorkspaceLoading },
    actions: { switchWorkspace },
  } = useWorkspace()

  // Inject accent color as CSS custom property
  useAccentColor(workspace?.accentColor)

  // Task state from beads-view
  const { error: tasksError, refresh } = useTasks()
  const { selectedTask, openDialogById, closeDialog } = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  // Selected task ID from store
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)
  const visibleTaskIds = useBeadsViewStore(selectVisibleTaskIds)

  // Refs for hotkey targets
  const searchInputRef = useRef<SearchInputHandle>(null)
  const taskChatInputRef = useRef<ChatInputHandle>(null)

  // Hotkey handlers - Agent actions
  const handleFocusChatInput = useCallback(() => {
    // Focus task chat or Ralph input depending on which is visible
    if (selectedTaskId !== null) {
      // Task detail is open, no chat visible
      return
    }
    taskChatInputRef.current?.focus()
  }, [selectedTaskId])

  const handleToggleToolOutput = useCallback(() => {
    useUiStore.getState().toggleToolOutput()
  }, [])

  const handleShowHotkeys = useCallback(() => {
    // TODO: Implement hotkeys dialog
    console.log("Show hotkeys dialog")
  }, [])

  // Hotkey handlers - Beads actions
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
      openDialogById(selectedTaskId)
    }
  }, [selectedTaskId, openDialogById])

  // Register hotkeys
  useAgentHotkeys({
    handlers: {
      focusChatInput: handleFocusChatInput,
      toggleToolOutput: handleToggleToolOutput,
      showHotkeys: handleShowHotkeys,
      // Note: newSession and scrollToBottom not implemented yet
    },
  })

  useBeadsHotkeys({
    handlers: {
      focusSearch: handleFocusSearch,
      focusTaskInput: handleFocusSearch,
      previousTask: handlePreviousTask,
      nextTask: handleNextTask,
      openTask: handleOpenTask,
      showHotkeys: handleShowHotkeys,
    },
  })

  // Handle task click from sidebar
  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      openDialogById(taskId)
    },
    [openDialogById, setSelectedTaskId],
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

  // Handle task chat message send
  const handleTaskChatSend = useCallback(
    (message: string) => {
      taskChatActions.sendMessage(message)
    },
    [taskChatActions],
  )

  // Handle task chat session select
  const handleTaskChatSessionSelect = useCallback(
    (sessionId: string) => {
      taskChatActions.restoreSession(sessionId)
    },
    [taskChatActions],
  )

  // Handle closing the task detail panel
  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null)
    closeDialog()
  }, [setSelectedTaskId, closeDialog])

  // Handle task changes (updates/deletes)
  const handleChanged = useCallback(() => {
    void refresh()
  }, [refresh])

  // Left sidebar: show TaskDetailPanel when a task is selected, otherwise TaskChatPanel
  const sidebar =
    selectedTaskId !== null ?
      <TaskDetailPanel
        task={selectedTask}
        open={selectedTaskId !== null}
        onClose={handleCloseDetail}
        onChanged={handleChanged}
      />
    : <TaskChatPanel
        taskId={null}
        taskTitle={undefined}
        events={taskChatState.events}
        isStreaming={taskChatState.isStreaming}
        sessionId={taskChatState.sessionId}
        onSendMessage={handleTaskChatSend}
        onSessionSelect={handleTaskChatSessionSelect}
        onClose={closeDialog}
      />

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
      <Header
        accentColor={workspace?.accentColor ?? null}
        workspace={workspace}
        workspaces={workspaces}
        isWorkspaceLoading={isWorkspaceLoading}
        onWorkspaceSwitch={switchWorkspace}
      />
      <MainLayout sidebar={sidebar} rightPanel={rightPanel}>
        {/* Tasks panel (center) */}
        <TaskSidebarController
          searchInputRef={searchInputRef}
          onTaskClick={handleTaskClick}
          onOpenTask={handleTaskClick}
        />
      </MainLayout>
      <StatusBar
        connectionStatus={connectionStatus}
        events={events}
        error={tasksError}
        controlState={controlState}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        currentTaskId={currentTaskId}
        currentTaskTitle={currentTaskTitle}
        workspaceName={workspace?.name}
        workspacePath={workspace?.path}
        branch={workspace?.branch}
      />
    </div>
  )
}
