import { useCallback, useRef, useState, useEffect } from "react"
import { MainLayout } from "./components/MainLayout"
import { Header } from "./components/layout"
import { RalphRunner } from "./components/RalphRunner"
import { TaskChatPanel } from "./components/TaskChatPanel"
import { TaskDetailSheet } from "./components/TaskDetailSheet"
import { StatusBar } from "./components/StatusBar"
import { HotkeysDialog } from "./components/HotkeysDialog"
import { CommandPalette } from "./components/CommandPalette"
import { useRalphLoop } from "./hooks/useRalphLoop"
import { useAccentColor } from "./hooks/useAccentColor"
import { useTaskChat } from "./hooks/useTaskChat"
import { useUiStore } from "./stores/uiStore"
import {
  TaskSidebarController,
  TaskProgressBar,
  BeadsViewProvider,
  configureApiClient,
  useTasks,
  useTaskDialog,
  useBeadsViewStore,
  selectSelectedTaskId,
  selectVisibleTaskIds,
  selectInitialTaskCount,
  selectClosedTimeFilter,
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

  // Workspace state from beads-view
  const {
    state: { current: workspace, workspaces, isLoading: isWorkspaceLoading },
    actions: { switchWorkspace },
  } = useWorkspace()

  // Inject accent color as CSS custom property
  useAccentColor(workspace?.accentColor)

  // Task state from beads-view
  const { tasks, error: tasksError, refresh } = useTasks()
  const { selectedTask, openDialogById, closeDialog } = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  // Selected task ID from store
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)
  const visibleTaskIds = useBeadsViewStore(selectVisibleTaskIds)

  // Task progress bar state from store
  const initialTaskCount = useBeadsViewStore(selectInitialTaskCount)
  const closedTimeFilter = useBeadsViewStore(selectClosedTimeFilter)

  // Refs for hotkey targets
  const searchInputRef = useRef<SearchInputHandle>(null)
  const taskChatInputRef = useRef<ChatInputHandle>(null)

  // Dialog state
  const [showHotkeysDialog, setShowHotkeysDialog] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Stop-after-current state (temporary local state until worker supports it)
  const [isStoppingAfterCurrent, setIsStoppingAfterCurrent] = useState(false)

  // Command palette keyboard listener (Cmd+K or Cmd+;)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === ";")) {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Hotkey handlers - Agent actions
  const handleFocusChatInput = useCallback(() => {
    // TaskChatPanel is always visible now, so always focus it
    taskChatInputRef.current?.focus()
  }, [])

  const handleToggleToolOutput = useCallback(() => {
    useUiStore.getState().toggleToolOutput()
  }, [])

  const handleShowHotkeys = useCallback(() => {
    setShowHotkeysDialog(true)
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

  // Command palette handlers
  const handleAgentStart = useCallback(() => {
    start()
  }, [start])

  const handleAgentStop = useCallback(() => {
    stop()
  }, [stop])

  const handleAgentPause = useCallback(() => {
    if (controlState === "paused") {
      resume()
    } else {
      pause()
    }
  }, [controlState, pause, resume])

  const handleCycleTheme = useCallback(() => {
    // TODO: Implement theme cycling
    console.log("Cycle theme")
  }, [])

  // Stop after current task handlers
  const handleStopAfterCurrent = useCallback(() => {
    setIsStoppingAfterCurrent(true)
    // TODO: Implement in SharedWorker to actually stop after current task
    // For now this just sets a flag that will be used for UI state
  }, [])

  const handleCancelStopAfterCurrent = useCallback(() => {
    setIsStoppingAfterCurrent(false)
  }, [])

  // Left sidebar: always show TaskChatPanel
  const sidebar = (
    <TaskChatPanel
      taskId={null}
      taskTitle={undefined}
      events={taskChatState.events}
      isStreaming={taskChatState.isStreaming}
      sessionId={taskChatState.sessionId}
      onSendMessage={handleTaskChatSend}
      onSessionSelect={handleTaskChatSessionSelect}
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
      <Header
        accentColor={workspace?.accentColor ?? null}
        workspace={workspace}
        workspaces={workspaces}
        isWorkspaceLoading={isWorkspaceLoading}
        onWorkspaceSwitch={switchWorkspace}
        onHelpClick={handleShowHotkeys}
      />
      <MainLayout sidebar={sidebar} rightPanel={rightPanel}>
        {/* Tasks panel (center) */}
        <TaskSidebarController
          searchInputRef={searchInputRef}
          onTaskClick={handleTaskClick}
          onOpenTask={handleTaskClick}
        />
        {/* Task completion progress */}
        <TaskProgressBar
          isRunning={controlState === "running"}
          tasks={tasks}
          initialTaskCount={initialTaskCount}
          accentColor={workspace?.accentColor ?? null}
          closedTimeFilter={closedTimeFilter}
        />
      </MainLayout>
      <StatusBar
        connectionStatus={connectionStatus}
        events={events}
        error={tasksError}
        controlState={controlState}
        isStoppingAfterCurrent={isStoppingAfterCurrent}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        onStopAfterCurrent={handleStopAfterCurrent}
        onCancelStopAfterCurrent={handleCancelStopAfterCurrent}
        workspaceName={workspace?.name}
        workspacePath={workspace?.path}
        branch={workspace?.branch}
        tasks={tasks}
        accentColor={workspace?.accentColor}
      />
      {/* Task detail sheet overlay */}
      <TaskDetailSheet
        task={selectedTask}
        open={selectedTaskId !== null}
        onClose={handleCloseDetail}
        onChanged={handleChanged}
      />
      <HotkeysDialog open={showHotkeysDialog} onClose={() => setShowHotkeysDialog(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        handlers={{
          agentStart: handleAgentStart,
          agentStop: handleAgentStop,
          agentPause: handleAgentPause,
          cycleTheme: handleCycleTheme,
          showHotkeys: handleShowHotkeys,
        }}
        controlState={controlState}
        isConnected={connectionStatus === "connected"}
      />
    </div>
  )
}
