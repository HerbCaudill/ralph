import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { MainLayout } from "./MainLayout"
import { Header } from "./Header"
import { RalphRunner } from "./RalphRunner"
import { TaskChatPanel } from "./TaskChatPanel"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { HotkeysDialog } from "./HotkeysDialog"
import { CommandPalette } from "./CommandPalette"
import { useRalphLoop } from "../hooks/useRalphLoop"
import { useRalphSessions } from "../hooks/useRalphSessions"
import { useAccentColor } from "../hooks/useAccentColor"
import { useTaskChat } from "../hooks/useTaskChat"
import { useWorkspaceParams } from "../hooks/useWorkspaceParams"
import { useUiStore } from "../stores/uiStore"
import {
  TaskPanelController,
  configureApiClient,
  getApiClientConfig,
  useTasks,
  useTaskDialog,
  useTaskNavigation,
  useTaskMutations,
  useBeadsViewStore,
  beadsViewStore,
  selectSelectedTaskId,
  useWorkspace,
  useBeadsHotkeys,
  type SearchInputHandle,
} from "@herbcaudill/beads-view"
import { useAgentHotkeys, type ChatInputHandle } from "@herbcaudill/agent-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"
import { useCurrentTask } from "@/hooks/useCurrentTask"
import { useWorkerName } from "@/hooks/useWorkerName"
import { createRalphEventRenderers } from "@/lib/createRalphEventRenderers"

/**
 * Workspace view — renders the main Ralph UI for a specific workspace.
 * Reads `owner` and `repo` from URL params to identify the workspace.
 */
export function WorkspaceView() {
  const { workspaceId } = useWorkspaceParams()
  const navigate = useNavigate()

  // Sync API client config with the workspace from the route.
  // This runs synchronously on first render so hooks that make API calls
  // (useWorkspace, useTasks, etc.) include the correct workspace parameter.
  const routeConfigApplied = useRef<string | undefined>(undefined)
  if (workspaceId && workspaceId !== routeConfigApplied.current) {
    routeConfigApplied.current = workspaceId
    const config = getApiClientConfig()
    configureApiClient({ ...config, workspaceId })
    // Save to localStorage so the root redirect picks it up next time
    try {
      localStorage.setItem("ralph-workspace-path", workspaceId)
    } catch {
      // Ignore storage errors
    }
  }

  // Ralph loop state from SharedWorker
  const {
    events: liveEvents,
    isStreaming: liveIsStreaming,
    controlState,
    connectionStatus,
    sessionId,
    isStoppingAfterCurrent,
    start,
    pause,
    resume,
    sendMessage,
    stopAfterCurrent,
    cancelStopAfterCurrent,
  } = useRalphLoop(workspaceId)

  // Session history management
  const { sessions, historicalEvents, isViewingHistorical, selectSession, clearHistorical } =
    useRalphSessions(sessionId)

  // Effective events and streaming state: use historical when viewing past sessions
  const events = isViewingHistorical && historicalEvents ? historicalEvents : liveEvents
  const isStreaming = isViewingHistorical ? false : liveIsStreaming

  // Task chat state from agent-server
  const { state: taskChatState, actions: taskChatActions } = useTaskChat()

  // Workspace state from beads-view
  const {
    state: { current: workspace, workspaces, isLoading: isWorkspaceLoading },
  } = useWorkspace()

  /** Switch workspace by navigating to its URL. */
  const handleWorkspaceSwitch = useCallback(
    (pathOrId: string) => {
      // Convert filesystem path to workspace ID if necessary
      const id = pathOrId.startsWith("/") ? getWorkspaceId({ workspacePath: pathOrId }) : pathOrId
      navigate(`/${id}`)
    },
    [navigate],
  )

  // Inject accent color as CSS custom property
  useAccentColor(workspace?.accentColor)

  // Sync accent color to the beads-view store so TaskProgressBar can use it
  useEffect(() => {
    beadsViewStore.getState().setAccentColor(workspace?.accentColor ?? null)
  }, [workspace?.accentColor])

  // Task state from beads-view
  const { tasks, refresh } = useTasks({ all: true })

  // Real-time task refresh via WebSocket
  useTaskMutations({ workspacePath: workspace?.path })

  // Sync initial task count to beads-view store so TaskProgressBar renders
  useEffect(() => {
    const store = beadsViewStore.getState()
    if (controlState !== "idle" && tasks.length > 0) {
      store.setInitialTaskCount(tasks.length)
    } else {
      store.setInitialTaskCount(null)
    }
  }, [controlState, tasks.length])

  // Current task from Ralph events (resolved against the tasks list)
  const { taskId: currentTaskId, taskTitle: currentTaskTitle } = useCurrentTask(events, tasks)

  // Active worker name from Ralph events
  const workerName = useWorkerName(events)
  const { selectedTask, openDialogById, closeDialog } = useTaskDialog({
    onTaskUpdated: refresh,
    onTaskDeleted: refresh,
  })

  // Selected task ID from store
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)

  // Refs for hotkey targets
  const searchInputRef = useRef<SearchInputHandle>(null)
  const taskChatInputRef = useRef<ChatInputHandle>(null)

  // Dialog state
  const [showHotkeysDialog, setShowHotkeysDialog] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Tool output visibility from persisted UI store
  const showToolOutput = useUiStore(state => state.showToolOutput)
  const toolOutputContext = useMemo(
    () => ({
      isVisible: showToolOutput,
      onToggle: () => useUiStore.getState().toggleToolOutput(),
    }),
    [showToolOutput],
  )

  // Custom event renderers for Ralph-specific events (task lifecycle, promise complete)
  const customEventRenderers = useMemo(() => createRalphEventRenderers(), [])

  // Command palette keyboard listener (Cmd+;)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ";") {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Hotkey handlers - Agent actions
  const handleFocusChatInput = useCallback(() => {
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

  // Handle task click from sidebar
  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      openDialogById(taskId)
    },
    [openDialogById, setSelectedTaskId],
  )

  // Task navigation with auto-open on arrow key navigation
  const { navigatePrevious, navigateNext, openSelected } = useTaskNavigation({
    onOpenTask: handleTaskClick,
  })

  // Handle task chat new session
  const handleTaskChatNewSession = useCallback(() => {
    taskChatActions.newSession()
  }, [taskChatActions])

  // Start Ralph hotkey handler
  const handleStartRalph = useCallback(() => {
    if (controlState === "idle" && connectionStatus === "connected") {
      start()
    }
  }, [controlState, connectionStatus, start])

  // Register hotkeys
  useAgentHotkeys({
    handlers: {
      focusChatInput: handleFocusChatInput,
      newSession: handleTaskChatNewSession,
      toggleToolOutput: handleToggleToolOutput,
      showHotkeys: handleShowHotkeys,
      startRalph: handleStartRalph,
    },
  })

  useBeadsHotkeys({
    handlers: {
      focusSearch: handleFocusSearch,
      focusTaskInput: handleFocusSearch,
      previousTask: navigatePrevious,
      nextTask: navigateNext,
      openTask: openSelected,
      showHotkeys: handleShowHotkeys,
    },
  })

  /** Handle session selection from the SessionPicker in RalphRunner. */
  const handleSelectSession = useCallback(
    (selectedSessionId: string) => {
      if (selectedSessionId === sessionId) {
        clearHistorical()
      } else {
        selectSession(selectedSessionId)
      }
    },
    [sessionId, clearHistorical, selectSession],
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
    pause()
    setTimeout(start, 100)
  }, [pause, start])

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

  const handleAgentPause = useCallback(() => {
    pause()
  }, [])

  const handleCycleTheme = useCallback(() => {
    console.log("Cycle theme")
  }, [])

  // Stop after current session handlers
  const handleStopAfterCurrent = useCallback(() => {
    stopAfterCurrent()
  }, [stopAfterCurrent])

  const handleCancelStopAfterCurrent = useCallback(() => {
    cancelStopAfterCurrent()
  }, [cancelStopAfterCurrent])

  // Left sidebar: always show TaskChatPanel
  const sidebar = (
    <TaskChatPanel
      taskId={null}
      taskTitle={undefined}
      events={taskChatState.events}
      isStreaming={taskChatState.isStreaming}
      sessionId={taskChatState.sessionId}
      toolOutput={toolOutputContext}
      onSendMessage={handleTaskChatSend}
      onSessionSelect={handleTaskChatSessionSelect}
      onNewSession={handleTaskChatNewSession}
      onClose={closeDialog}
    />
  )

  // Ralph loop panel (right side)
  const rightPanel = (
    <RalphRunner
      events={events}
      isStreaming={isStreaming}
      controlState={controlState}
      connectionStatus={connectionStatus}
      workspaceName={workspace?.name}
      branch={workspace?.branch}
      workspacePath={workspace?.path}
      isStoppingAfterCurrent={isStoppingAfterCurrent}
      sessions={sessions}
      sessionId={sessionId}
      isViewingHistoricalSession={isViewingHistorical}
      taskId={currentTaskId}
      taskTitle={currentTaskTitle}
      workerName={workerName}
      context={{
        toolOutput: toolOutputContext,
        workspacePath: workspace?.path,
        customEventRenderers,
        tasks,
      }}
      onSendMessage={handleRalphSend}
      onSelectSession={handleSelectSession}
      onStart={start}
      onResume={resume}
      onPause={pause}
      onStopAfterCurrent={handleStopAfterCurrent}
      onCancelStopAfterCurrent={handleCancelStopAfterCurrent}
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
        onWorkspaceSwitch={handleWorkspaceSwitch}
        onHelpClick={handleShowHotkeys}
      />
      <MainLayout
        sidebar={sidebar}
        rightPanel={rightPanel}
        overlay={
          <TaskDetailSheet
            task={selectedTask}
            open={selectedTaskId !== null}
            onClose={handleCloseDetail}
            onChanged={handleChanged}
          />
        }
      >
        <TaskPanelController
          searchInputRef={searchInputRef}
          onTaskClick={handleTaskClick}
          onOpenTask={handleTaskClick}
          isRunning={controlState === "running"}
        />
      </MainLayout>
      <HotkeysDialog open={showHotkeysDialog} onClose={() => setShowHotkeysDialog(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        handlers={{
          agentStart: handleAgentStart,
          agentStop: handleAgentPause, // Pause now serves as stop
          agentPause: handleAgentPause,
          cycleTheme: handleCycleTheme,
          showHotkeys: handleShowHotkeys,
          focusChatInput: handleFocusChatInput,
          newSession: handleTaskChatNewSession,
          toggleToolOutput: handleToggleToolOutput,
          startRalph: handleStartRalph,
          focusSearch: handleFocusSearch,
          focusTaskInput: handleFocusSearch,
          previousTask: navigatePrevious,
          nextTask: navigateNext,
          openTask: openSelected,
        }}
        controlState={controlState}
        isConnected={connectionStatus === "connected"}
      />
    </div>
  )
}
