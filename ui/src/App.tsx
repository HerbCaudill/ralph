import { useRef, useCallback, useState, useEffect } from "react"
import {
  MainLayout,
  type MainLayoutHandle,
  StatusBar,
  HotkeysDialog,
  CommandPalette,
} from "./components/layout"
import { ChatInput, type ChatInputHandle } from "./components/chat/ChatInput"
import { EventStream, EventLogViewer } from "./components/events"
import { TaskSidebar } from "./components/tasks/TaskSidebar"
import { TaskList } from "./components/tasks/TaskList"
import { TaskDetailsDialog } from "./components/tasks/TaskDetailsDialog"
import { QuickTaskInput, type QuickTaskInputHandle } from "./components/tasks/QuickTaskInput"
import { type SearchInputHandle } from "./components/tasks/SearchInput"
import {
  useAppStore,
  selectRalphStatus,
  selectIsRalphRunning,
  selectIsConnected,
  selectTaskChatOpen,
  selectTaskChatWidth,
  selectViewingEventLogId,
  selectIsSearchVisible,
} from "./store"
import { TaskChatPanel } from "./components/chat/TaskChatPanel"
import {
  useRalphConnection,
  useHotkeys,
  useTheme,
  useTasks,
  useTaskDialog,
  useTaskDialogRouter,
  useEventLogRouter,
  useWorkspaces,
} from "./hooks"
import { TaskDialogProvider } from "./contexts"

// API Functions (for hotkeys)

async function startRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to start" }
  }
}

async function stopRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to stop" }
  }
}

async function pauseRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to pause" }
  }
}

async function resumeRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to resume" }
  }
}

async function stopAfterCurrentRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stop-after-current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to stop after current" }
  }
}

async function clearTaskChatHistory(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/task-chat/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to clear history" }
  }
}

// Tasks Sidebar

interface TasksSidebarPanelProps {
  quickInputRef?: React.RefObject<QuickTaskInputHandle | null>
  searchInputRef?: React.RefObject<SearchInputHandle | null>
  onTaskClick?: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
  onTaskCreated?: () => void
  isSearchVisible?: boolean
  onHideSearch?: () => void
}

function TasksSidebarPanel({
  quickInputRef,
  searchInputRef,
  onTaskClick,
  onOpenTask,
  onTaskCreated,
  isSearchVisible,
  onHideSearch,
}: TasksSidebarPanelProps) {
  const { tasks, refresh } = useTasks({ all: true })

  const handleTaskCreated = useCallback(async () => {
    await refresh()
    onTaskCreated?.()
  }, [refresh, onTaskCreated])

  return (
    <TaskSidebar
      quickInput={<QuickTaskInput ref={quickInputRef} onTaskCreated={handleTaskCreated} />}
      taskList={<TaskList tasks={tasks} onTaskClick={onTaskClick} />}
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
      isSearchVisible={isSearchVisible}
      onHideSearch={onHideSearch}
    />
  )
}

interface AgentViewProps {
  chatInputRef?: React.RefObject<ChatInputHandle | null>
}

function AgentView({ chatInputRef }: AgentViewProps) {
  const { sendMessage, isConnected } = useRalphConnection()
  const isRalphRunning = useAppStore(selectIsRalphRunning)

  return (
    <div className="flex h-full flex-col">
      {/* Event stream */}
      <div className="min-h-0 flex-1">
        <EventStream />
      </div>

      {/* Chat input */}
      <div className="border-border border-t p-4">
        <ChatInput
          ref={chatInputRef}
          onSubmit={sendMessage}
          disabled={!isConnected || !isRalphRunning}
          placeholder={
            !isConnected ? "Connecting..."
            : !isRalphRunning ?
              "Start Ralph to send messages..."
            : "Send Ralph a message..."
          }
        />
      </div>
    </div>
  )
}

// App Component

export function App() {
  const layoutRef = useRef<MainLayoutHandle>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const quickTaskInputRef = useRef<QuickTaskInputHandle>(null)
  const searchInputRef = useRef<SearchInputHandle>(null)

  // Initialize theme management (applies dark class and listens for system changes)
  const { cycleTheme } = useTheme()

  // Task list refresh
  const { refresh: refreshTaskList } = useTasks({ all: true })

  // Task dialog state
  const taskDialog = useTaskDialog({
    onTaskUpdated: async () => {
      await refreshTaskList()
    },
  })

  // Task dialog URL routing - handles #id={taskId} hash parsing and navigation
  const taskDialogRouter = useTaskDialogRouter({ taskDialog })

  // Event log URL routing - handles #eventlog={id} hash parsing and navigation
  useEventLogRouter()

  // Workspace navigation
  const { goToPreviousWorkspace, goToNextWorkspace } = useWorkspaces()

  // Hotkeys dialog state
  const [hotkeysDialogOpen, setHotkeysDialogOpen] = useState(false)

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Handle task click - open the dialog
  const handleTaskClick = useCallback(
    (taskId: string) => {
      taskDialog.openDialogById(taskId)
    },
    [taskDialog],
  )

  // Get state for hotkey conditions
  const ralphStatus = useAppStore(selectRalphStatus)
  const isConnected = useAppStore(selectIsConnected)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleTaskChat = useAppStore(state => state.toggleTaskChat)

  // Iteration navigation
  const goToPreviousIteration = useAppStore(state => state.goToPreviousIteration)
  const goToNextIteration = useAppStore(state => state.goToNextIteration)
  const goToLatestIteration = useAppStore(state => state.goToLatestIteration)

  // Tool output visibility
  const toggleToolOutput = useAppStore(state => state.toggleToolOutput)

  // Task chat panel state
  const taskChatOpen = useAppStore(selectTaskChatOpen)
  const taskChatWidth = useAppStore(selectTaskChatWidth)
  const setTaskChatWidth = useAppStore(state => state.setTaskChatWidth)
  const clearTaskChatMessages = useAppStore(state => state.clearTaskChatMessages)
  const setTaskChatStreamingText = useAppStore(state => state.setTaskChatStreamingText)

  // Event log viewer state
  const viewingEventLogId = useAppStore(selectViewingEventLogId)
  const isViewingEventLog = viewingEventLogId !== null

  // Search visibility state
  const isSearchVisible = useAppStore(selectIsSearchVisible)
  const showSearch = useAppStore(state => state.showSearch)
  const hideSearch = useAppStore(state => state.hideSearch)

  // Handle task chat panel width change
  const handleTaskChatWidthChange = useCallback(
    (width: number) => {
      setTaskChatWidth(width)
    },
    [setTaskChatWidth],
  )

  // Handle task chat panel close
  const handleTaskChatClose = useCallback(() => {
    toggleTaskChat()
  }, [toggleTaskChat])

  // Hotkey handlers
  const handleAgentStart = useCallback(async () => {
    // Only start if stopped and connected
    if (ralphStatus !== "stopped" || !isConnected) return
    await startRalph()
  }, [ralphStatus, isConnected])

  const handleAgentStop = useCallback(async () => {
    // Only stop if running and connected
    if (ralphStatus !== "running" || !isConnected) return
    await stopRalph()
  }, [ralphStatus, isConnected])

  const handleAgentPause = useCallback(async () => {
    // Toggle between pause and resume based on current status
    if (ralphStatus === "paused") {
      await resumeRalph()
    } else if (ralphStatus === "running" && isConnected) {
      await pauseRalph()
    }
  }, [ralphStatus, isConnected])

  const handleAgentStopAfterCurrent = useCallback(async () => {
    // Only stop-after-current if running or paused and connected
    if ((ralphStatus !== "running" && ralphStatus !== "paused") || !isConnected) return
    await stopAfterCurrentRalph()
  }, [ralphStatus, isConnected])

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar()
  }, [toggleSidebar])

  const handleFocusSidebar = useCallback(() => {
    layoutRef.current?.focusSidebar()
  }, [])

  const handleFocusMain = useCallback(() => {
    layoutRef.current?.focusMain()
  }, [])

  const handleFocusTaskInput = useCallback(() => {
    quickTaskInputRef.current?.focus()
  }, [])

  const handleFocusChatInput = useCallback(() => {
    chatInputRef.current?.focus()
  }, [])

  // Toggle focus between task input and chat input
  const handleToggleInputFocus = useCallback(() => {
    // Check if task input is currently focused
    const activeElement = document.activeElement
    const taskInput = document.querySelector('[aria-label="New task title"]')

    if (activeElement === taskInput) {
      chatInputRef.current?.focus()
    } else {
      quickTaskInputRef.current?.focus()
    }
  }, [])

  const handleCycleTheme = useCallback(() => {
    cycleTheme()
  }, [cycleTheme])

  const handleShowHotkeys = useCallback(() => {
    setHotkeysDialogOpen(true)
  }, [])

  const handleCloseHotkeysDialog = useCallback(() => {
    setHotkeysDialogOpen(false)
  }, [])

  const handleShowCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [])

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [])

  const handleToggleTaskChat = useCallback(() => {
    const isCurrentlyOpen = useAppStore.getState().taskChatOpen
    toggleTaskChat()
    // If we're opening the panel, focus the input
    if (!isCurrentlyOpen) {
      setTimeout(() => {
        const taskChatInput = document.querySelector(
          '[aria-label="Task chat input"]',
        ) as HTMLElement
        taskChatInput?.focus()
      }, 50)
    }
  }, [toggleTaskChat])

  const handleFocusTaskChatInput = useCallback(() => {
    // Focus the task chat input element
    // First ensure the panel is open
    const taskChatOpen = useAppStore.getState().taskChatOpen
    if (!taskChatOpen) {
      toggleTaskChat()
    }
    // Focus the input after a brief delay to allow panel to render
    setTimeout(() => {
      const taskChatInput = document.querySelector('[aria-label="Task chat input"]') as HTMLElement
      taskChatInput?.focus()
    }, 50)
  }, [toggleTaskChat])

  const handleFocusSearch = useCallback(() => {
    showSearch()
    // Focus the input after a brief delay to allow it to render
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 50)
  }, [showSearch])

  useEffect(() => {
    if (!isSearchVisible) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }
      // If there's text in the search box, clear and hide regardless of focus
      const searchQuery = useAppStore.getState().taskSearchQuery
      if (searchQuery) {
        hideSearch()
        return
      }
      // If no text, only hide when the search input is focused
      const activeElement = document.activeElement
      if (activeElement?.getAttribute("aria-label") === "Search tasks") {
        hideSearch()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("keydown", handleEscape)
    }
  }, [hideSearch, isSearchVisible])

  const handleClearTaskChat = useCallback(async () => {
    const result = await clearTaskChatHistory()
    if (result.ok) {
      clearTaskChatMessages()
      setTaskChatStreamingText("")
    }
  }, [clearTaskChatMessages, setTaskChatStreamingText])

  // Register hotkeys
  useHotkeys({
    handlers: {
      agentStart: handleAgentStart,
      agentStop: handleAgentStop,
      agentPause: handleAgentPause,
      agentStopAfterCurrent: handleAgentStopAfterCurrent,
      toggleSidebar: handleToggleSidebar,
      focusSidebar: handleFocusSidebar,
      focusMain: handleFocusMain,
      focusTaskInput: handleFocusTaskInput,
      focusChatInput: handleFocusChatInput,
      cycleTheme: handleCycleTheme,
      showHotkeys: handleShowHotkeys,
      toggleInputFocus: handleToggleInputFocus,
      toggleTaskChat: handleToggleTaskChat,
      focusTaskChatInput: handleFocusTaskChatInput,
      showCommandPalette: handleShowCommandPalette,
      previousIteration: goToPreviousIteration,
      nextIteration: goToNextIteration,
      latestIteration: goToLatestIteration,
      focusSearch: handleFocusSearch,
      previousWorkspace: goToPreviousWorkspace,
      nextWorkspace: goToNextWorkspace,
      toggleToolOutput: toggleToolOutput,
      clearTaskChat: handleClearTaskChat,
    },
  })

  // Track whether we've auto-started Ralph (to avoid restarting on reconnection)
  const hasAutoStarted = useRef(false)

  // Auto-start Ralph on first connection
  useEffect(() => {
    if (isConnected && ralphStatus === "stopped" && !hasAutoStarted.current) {
      hasAutoStarted.current = true
      startRalph()
    }
  }, [isConnected, ralphStatus])

  // Auto-focus task input on mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      quickTaskInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <TaskDialogProvider openTaskById={taskDialog.openDialogById}>
      <MainLayout
        ref={layoutRef}
        sidebar={
          <TasksSidebarPanel
            quickInputRef={quickTaskInputRef}
            searchInputRef={searchInputRef}
            onTaskClick={handleTaskClick}
            onOpenTask={handleTaskClick}
            isSearchVisible={isSearchVisible}
            onHideSearch={hideSearch}
          />
        }
        main={<AgentView chatInputRef={chatInputRef} />}
        statusBar={<StatusBar />}
        leftPanel={<TaskChatPanel onClose={handleTaskChatClose} />}
        leftPanelOpen={taskChatOpen}
        leftPanelWidth={taskChatWidth}
        onLeftPanelWidthChange={handleTaskChatWidthChange}
        rightPanel={<EventLogViewer />}
        rightPanelOpen={isViewingEventLog}
        rightPanelWidth={taskChatWidth}
        onRightPanelWidthChange={handleTaskChatWidthChange}
        detailPanel={
          <TaskDetailsDialog
            task={taskDialog.selectedTask}
            open={taskDialog.isOpen}
            onClose={taskDialogRouter.closeTaskDialog}
            onSave={taskDialog.saveTask}
            onDelete={taskDialog.deleteTask}
          />
        }
        detailPanelOpen={taskDialog.isOpen}
        onDetailPanelClose={taskDialogRouter.closeTaskDialog}
      />
      <HotkeysDialog open={hotkeysDialogOpen} onClose={handleCloseHotkeysDialog} />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
        handlers={{
          agentStart: handleAgentStart,
          agentStop: handleAgentStop,
          agentPause: handleAgentPause,
          toggleSidebar: handleToggleSidebar,
          cycleTheme: handleCycleTheme,
          showHotkeys: handleShowHotkeys,
          focusTaskInput: handleFocusTaskInput,
          focusChatInput: handleFocusChatInput,
          toggleTaskChat: handleToggleTaskChat,
        }}
        ralphStatus={ralphStatus}
        isConnected={isConnected}
      />
    </TaskDialogProvider>
  )
}
