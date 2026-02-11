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
import { useTaskChatSessions } from "../hooks/useTaskChatSessions"
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
import {
  useAgentHotkeys,
  useAdapterInfo,
  useDetectedModel,
  formatModelName,
  type ChatInputHandle,
} from "@herbcaudill/agent-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"
import { useCurrentTask } from "@/hooks/useCurrentTask"
import { useWorkerName } from "@/hooks/useWorkerName"
import { useWorkerOrchestrator } from "@/hooks/useWorkerOrchestrator"
import { createRalphEventRenderers } from "@/lib/createRalphEventRenderers"
import { WorkerControlBar } from "@/components/WorkerControlBar"

/**
 * Workspace view — renders the main Ralph UI for a specific workspace.
 * Reads `owner` and `repo` from URL params to identify the workspace.
 */
export function WorkspaceView() {
  const { workspaceId, sessionId: urlSessionId } = useWorkspaceParams()
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
    isStoppingAfterCurrentGlobal,
    start,
    pause,
    resume,
    sendMessage,
    stopAfterCurrentGlobal,
    cancelStopAfterCurrentGlobal,
  } = useRalphLoop(workspaceId)

  // Session history management
  const { sessions, historicalEvents, isViewingHistorical, selectSession, clearHistorical } =
    useRalphSessions(sessionId, workspaceId)

  // Load session from URL when navigating directly to a session URL.
  // Only triggers when URL sessionId is different from the live sessionId.
  const urlSessionIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    // Skip if the URL session ID hasn't changed
    if (urlSessionId === urlSessionIdRef.current) return
    urlSessionIdRef.current = urlSessionId

    // If URL has a session ID that differs from the current live session, load it
    if (urlSessionId && urlSessionId !== sessionId) {
      selectSession(urlSessionId)
    }
  }, [urlSessionId, sessionId, selectSession])

  // Effective events and streaming state: use historical when viewing past sessions
  const events = isViewingHistorical && historicalEvents ? historicalEvents : liveEvents
  const isStreaming = isViewingHistorical ? false : liveIsStreaming

  // Task chat state from agent-server (scoped to workspace)
  const { state: taskChatState, actions: taskChatActions } = useTaskChat(workspaceId)

  // Task chat session history from server
  const { sessions: taskChatSessions } = useTaskChatSessions(taskChatState.sessionId, workspaceId)

  // Workspace state from beads-view
  const {
    state: { current: workspace, workspaces, isLoading: isWorkspaceLoading },
    actions: { switchWorkspace },
  } = useWorkspace()

  // When the route changes (user switches workspace via URL), sync workspace state.
  // Skip the initial render — useWorkspace's init effect handles that.
  const prevWorkspaceId = useRef(workspaceId)
  useEffect(() => {
    if (workspaceId && workspaceId !== prevWorkspaceId.current) {
      prevWorkspaceId.current = workspaceId
      switchWorkspace(workspaceId)
    }
  }, [workspaceId, switchWorkspace])

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

  // Agent adapter and model info for the Header
  const agentType = "claude" as const
  const { model: adapterModel } = useAdapterInfo(agentType)
  const detectedModel = useDetectedModel(events)
  const modelName = formatModelName(detectedModel ?? adapterModel)
  const agentDisplayName = agentType.charAt(0).toUpperCase() + agentType.slice(1)

  // Worker orchestrator for parallel execution control
  const orchestrator = useWorkerOrchestrator(workspaceId)

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
    taskChatInputRef.current?.focus()
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
        // Going back to the live session - clear historical view and update URL
        clearHistorical()
        navigate(`/${workspaceId}`, { replace: true })
      } else {
        // Viewing a historical session - load events and update URL
        selectSession(selectedSessionId)
        navigate(`/${workspaceId}/${selectedSessionId}`, { replace: true })
      }
    },
    [sessionId, clearHistorical, selectSession, navigate, workspaceId],
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

  // Stop after current session handlers (use global stop to stop ALL Ralph loops)
  const handleStopAfterCurrent = useCallback(() => {
    stopAfterCurrentGlobal()
  }, [stopAfterCurrentGlobal])

  const handleCancelStopAfterCurrent = useCallback(() => {
    cancelStopAfterCurrentGlobal()
  }, [cancelStopAfterCurrentGlobal])

  // Left sidebar: always show TaskChatPanel
  const sidebar = (
    <TaskChatPanel
      taskId={null}
      taskTitle={undefined}
      events={taskChatState.events}
      isStreaming={taskChatState.isStreaming}
      sessionId={taskChatState.sessionId}
      sessions={taskChatSessions}
      toolOutput={toolOutputContext}
      onSendMessage={handleTaskChatSend}
      onSessionSelect={handleTaskChatSessionSelect}
      onNewSession={handleTaskChatNewSession}
      onClose={closeDialog}
      inputRef={taskChatInputRef}
    />
  )

  // Ralph loop panel (right side)
  // Use global stopping state to show "Stopping..." for the global stop-after-current
  const effectiveIsStoppingAfterCurrent = isStoppingAfterCurrent || isStoppingAfterCurrentGlobal
  const rightPanel = (
    <RalphRunner
      events={events}
      isStreaming={isStreaming}
      controlState={controlState}
      connectionStatus={connectionStatus}
      isStoppingAfterCurrent={effectiveIsStoppingAfterCurrent}
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
        agentDisplayName={agentDisplayName}
        modelName={modelName}
        workspaceName={workspace?.name}
        branch={workspace?.branch}
        workspacePath={workspace?.path}
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
        {/* Worker control bar for parallel worker orchestration */}
        <WorkerControlBar
          workers={Object.values(orchestrator.workers)}
          isStoppingAfterCurrent={orchestrator.state === "stopping"}
          isConnected={orchestrator.isConnected}
          onPauseWorker={orchestrator.pauseWorker}
          onResumeWorker={orchestrator.resumeWorker}
          onStopWorker={orchestrator.stopWorker}
          onStopAfterCurrent={orchestrator.stopAfterCurrent}
          onCancelStopAfterCurrent={orchestrator.cancelStopAfterCurrent}
        />
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
