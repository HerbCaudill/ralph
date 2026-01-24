import { useRef, useCallback, useState, useEffect } from "react"
import {
  MainLayout,
  type MainLayoutHandle,
  StatusBar,
  HotkeysDialog,
  CommandPalette,
} from "./components/layout"
import { type ChatInputHandle } from "./components/chat/ChatInput"
import { EventLogViewer } from "./components/events"
import { TaskDetailsDialog } from "./components/tasks/TaskDetailsDialog"
import { type QuickTaskInputHandle } from "./components/tasks/QuickTaskInput"
import { type SearchInputHandle } from "./components/tasks/SearchInput"
import {
  useAppStore,
  selectRalphStatus,
  selectIsConnected,
  selectTaskChatOpen,
  selectTaskChatWidth,
  selectViewingEventLogId,
  selectIsSearchVisible,
  selectSelectedTaskId,
  selectVisibleTaskIds,
  selectHotkeysDialogOpen,
  selectActiveInstanceId,
  selectEvents,
  selectTokenUsage,
  selectContextWindow,
  selectIteration,
  selectTaskChatMessages,
  selectTaskChatEvents,
  selectCurrentTask,
} from "./store"
import { TaskChatPanel } from "./components/chat/TaskChatPanel"
import {
  useHotkeys,
  useTheme,
  useTasks,
  useTaskDialog,
  useTaskDialogRouter,
  useEventLogRouter,
  useWorkspaces,
  useStoreHydration,
  useIterationPersistence,
  useTaskChatPersistence,
} from "./hooks"
import { startRalph } from "./lib/startRalph"
import { stopRalph } from "./lib/stopRalph"
import { pauseRalph } from "./lib/pauseRalph"
import { resumeRalph } from "./lib/resumeRalph"
import { stopAfterCurrentRalph } from "./lib/stopAfterCurrentRalph"
import { clearTaskChatHistory } from "./lib/clearTaskChatHistory"
import { TasksSidebarPanel } from "./components/TasksSidebarPanel"
import { AgentView } from "./components/AgentView"

/**  Root application component. */
export function App() {
  const layoutRef = useRef<MainLayoutHandle>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const quickTaskInputRef = useRef<QuickTaskInputHandle>(null)
  const searchInputRef = useRef<SearchInputHandle>(null)

  // Initialize theme management (applies dark class and listens for system changes)
  const { cycleTheme } = useTheme()

  // Get active instance ID for hydration
  const activeInstanceId = useAppStore(selectActiveInstanceId)

  // Hydrate store from IndexedDB on startup (restores events and task chat from last session)
  useStoreHydration({ instanceId: activeInstanceId })

  // Subscribe to state for iteration persistence
  const events = useAppStore(selectEvents)
  const tokenUsage = useAppStore(selectTokenUsage)
  const contextWindow = useAppStore(selectContextWindow)
  const iteration = useAppStore(selectIteration)

  // Persist iteration events to IndexedDB (auto-saves on iteration boundaries and completion)
  useIterationPersistence({
    instanceId: activeInstanceId,
    events,
    tokenUsage,
    contextWindow,
    iteration,
  })

  // Subscribe to state for task chat persistence
  const taskChatMessages = useAppStore(selectTaskChatMessages)
  const taskChatEvents = useAppStore(selectTaskChatEvents)
  const currentTask = useAppStore(selectCurrentTask)

  // Persist task chat sessions to IndexedDB (auto-saves on new messages/events)
  useTaskChatPersistence({
    instanceId: activeInstanceId,
    taskId: currentTask?.id ?? null,
    taskTitle: currentTask?.title ?? null,
    messages: taskChatMessages,
    events: taskChatEvents,
  })

  // Task list refresh
  const { refresh: refreshTaskList } = useTasks({ all: true })

  // Task dialog state
  const taskDialog = useTaskDialog({
    onTaskUpdated: async () => {
      await refreshTaskList()
    },
  })

  // Task dialog URL routing - handles /issue/{taskId} path parsing and navigation
  const taskDialogRouter = useTaskDialogRouter({ taskDialog })

  // Event log URL routing - handles #eventlog={id} hash parsing and navigation
  useEventLogRouter()

  // Workspace navigation
  const { goToPreviousWorkspace, goToNextWorkspace } = useWorkspaces()

  // Hotkeys dialog state from store
  const hotkeysDialogOpen = useAppStore(selectHotkeysDialogOpen)
  const openHotkeysDialog = useAppStore(state => state.openHotkeysDialog)
  const closeHotkeysDialog = useAppStore(state => state.closeHotkeysDialog)

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Get state for hotkey conditions
  const ralphStatus = useAppStore(selectRalphStatus)
  const isConnected = useAppStore(selectIsConnected)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleTaskChat = useAppStore(state => state.toggleTaskChat)

  // Iteration navigation
  const goToPreviousIteration = useAppStore(state => state.goToPreviousIteration)
  const goToNextIteration = useAppStore(state => state.goToNextIteration)
  const goToLatestIteration = useAppStore(state => state.goToLatestIteration)

  // Task navigation
  const selectedTaskId = useAppStore(selectSelectedTaskId)
  const visibleTaskIds = useAppStore(selectVisibleTaskIds)
  const setSelectedTaskId = useAppStore(state => state.setSelectedTaskId)

  // Handle task click - select the task and open the dialog
  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      taskDialog.openDialogById(taskId)
    },
    [setSelectedTaskId, taskDialog],
  )

  // Tool output visibility
  const toggleToolOutput = useAppStore(state => state.toggleToolOutput)

  // Task chat panel state
  const taskChatOpen = useAppStore(selectTaskChatOpen)
  const taskChatWidth = useAppStore(selectTaskChatWidth)
  const setTaskChatWidth = useAppStore(state => state.setTaskChatWidth)
  const clearTaskChatMessages = useAppStore(state => state.clearTaskChatMessages)

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

  // Toggle focus between task input, search input (if visible), and chat input
  const handleToggleInputFocus = useCallback(() => {
    const activeElement = document.activeElement
    const taskInput = document.querySelector('[aria-label="New task title"]')
    const searchInput = document.querySelector('[aria-label="Search tasks"]')

    // When search is visible, rotate through all three inputs
    // Order: task input -> search input -> chat input -> task input
    if (isSearchVisible && searchInput) {
      if (activeElement === taskInput) {
        ;(searchInput as HTMLElement).focus()
      } else if (activeElement === searchInput) {
        chatInputRef.current?.focus()
      } else {
        quickTaskInputRef.current?.focus()
      }
    } else {
      // When search is hidden, toggle between task input and chat input
      if (activeElement === taskInput) {
        chatInputRef.current?.focus()
      } else {
        quickTaskInputRef.current?.focus()
      }
    }
  }, [isSearchVisible])

  const handleCycleTheme = useCallback(() => {
    cycleTheme()
  }, [cycleTheme])

  const handleShowHotkeys = useCallback(() => {
    openHotkeysDialog()
  }, [openHotkeysDialog])

  const handleCloseHotkeysDialog = useCallback(() => {
    closeHotkeysDialog()
  }, [closeHotkeysDialog])

  const handleShowCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [])

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [])

  const handleToggleTaskChat = useCallback(() => {
    const isCurrentlyOpen = useAppStore.getState().taskChatOpen
    const taskChatInput = document.querySelector('[aria-label="Task chat input"]') as HTMLElement
    const isInputFocused = taskChatInput && document.activeElement === taskChatInput

    if (isCurrentlyOpen && !isInputFocused) {
      // Panel is open but input is not focused: focus the input
      taskChatInput?.focus()
    } else if (isCurrentlyOpen && isInputFocused) {
      // Panel is open and input is focused: close the panel
      toggleTaskChat()
    } else {
      // Panel is closed: open it and focus the input
      toggleTaskChat()
      setTimeout(() => {
        const input = document.querySelector('[aria-label="Task chat input"]') as HTMLElement
        input?.focus()
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

  const handleNewChat = useCallback(async () => {
    const result = await clearTaskChatHistory()
    if (result.ok) {
      clearTaskChatMessages()
    }
  }, [clearTaskChatMessages])

  // Task navigation handlers
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
      taskDialog.openDialogById(selectedTaskId)
    }
  }, [selectedTaskId, taskDialog])

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
      newChat: handleNewChat,
      previousTask: handlePreviousTask,
      nextTask: handleNextTask,
      openTask: handleOpenTask,
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
    <>
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
    </>
  )
}
