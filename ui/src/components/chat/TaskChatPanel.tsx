import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { EventList, useEventListState } from "@/components/events/EventList"
import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import { cn } from "@/lib/utils"
import {
  selectIsConnected,
  selectTaskChatEvents,
  selectTaskChatLoading,
  selectTaskChatMessages,
  useAppStore,
} from "@/store"
import type { ChatEvent, TaskChatMessage } from "@/types"
import { IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import { TaskChatHistoryDropdown } from "./TaskChatHistoryDropdown"
import { TopologySpinner } from "../ui/TopologySpinner"

/**
 * Converts TaskChatMessage objects to ChatEvent format for unified rendering.
 * Only converts user messages - assistant content comes from SDK events.
 */
function toChatEvents(userMessages: TaskChatMessage[], taskChatEvents: ChatEvent[]): ChatEvent[] {
  // Convert user TaskChatMessages to ChatEvent format
  const userEvents: ChatEvent[] = userMessages
    .filter(msg => msg.role === "user")
    .map(msg => ({
      type: "user_message",
      timestamp: msg.timestamp,
      message: msg.content,
    }))

  // Merge with task chat events and sort by timestamp
  return [...userEvents, ...taskChatEvents].sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Task chat panel for task management conversations with Claude.
 * Displays a chat interface with message history and input.
 *
 * Uses the shared EventList component for rendering events, converting
 * user messages to ChatEvent format for unified display.
 */
export function TaskChatPanel({ className, onClose }: TaskChatPanelProps) {
  // User messages (typed by the user)
  const userMessages = useAppStore(selectTaskChatMessages)
  // Raw SDK events (for assistant content with proper interleaving)
  const taskChatEvents = useAppStore(selectTaskChatEvents)
  const isLoading = useAppStore(selectTaskChatLoading)
  const isConnected = useAppStore(selectIsConnected)
  const addMessage = useAppStore(state => state.addTaskChatMessage)
  const removeMessage = useAppStore(state => state.removeTaskChatMessage)
  const setLoading = useAppStore(state => state.setTaskChatLoading)
  const clearMessages = useAppStore(state => state.clearTaskChatMessages)

  const chatInputRef = useRef<ChatInputHandle>(null)
  const [error, setError] = useState<string | null>(null)

  // Convert user messages to ChatEvent format and merge with task chat events
  const allEvents = useMemo(
    () => toChatEvents(userMessages, taskChatEvents),
    [userMessages, taskChatEvents],
  )

  // Use the shared EventList state hook for content detection
  const { hasContent, streamingMessage } = useEventListState(allEvents)

  const wasLoadingRef = useRef(false)

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      chatInputRef.current?.focus()
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoading && loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [isLoading])

  /**
   * Handle sending a message to the task chat.
   */
  const handleSendMessage = useCallback(
    async (
      /** The message text to send */
      message: string,
    ) => {
      const messageId = `user-${Date.now()}`
      setError(null)

      const userMessage: TaskChatMessage = {
        id: messageId,
        role: "user",
        content: message,
        timestamp: Date.now(),
      }
      addMessage(userMessage)
      setLoading(true)

      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }

      loadingTimeoutRef.current = setTimeout(() => {
        setLoading(false)
        loadingTimeoutRef.current = null
      }, 60_000)

      const result = await sendTaskChatMessage(message)

      if (!result.ok) {
        const errorMessage = result.error ?? "Failed to send message"
        const isAlreadyInProgress = errorMessage.toLowerCase().includes("already in progress")

        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }

        if (isAlreadyInProgress) {
          removeMessage(messageId)
          loadingTimeoutRef.current = setTimeout(() => {
            setLoading(false)
            loadingTimeoutRef.current = null
          }, 60_000)
          return
        }

        setLoading(false)
        setError(errorMessage)
      }
    },
    [addMessage, setLoading, removeMessage],
  )

  /**
   * Handle clearing the chat history.
   */
  const handleClearHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await clearTaskChatHistory()

    if (result.ok) {
      clearMessages()
    }
    setLoading(false)
  }, [clearMessages, setLoading])

  const inputPlaceholder =
    !isConnected ? "Connecting..."
    : isLoading ? "Waiting for response..."
    : "How can I help?"

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <IconMessageChatbot className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Task Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <TaskChatHistoryDropdown />
          <button
            onClick={handleClearHistory}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors disabled:opacity-50"
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            <IconTrash className="size-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              aria-label="Close task chat"
              title="Close"
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages container */}
      <ContentStreamContainer
        className="flex-1 overflow-hidden"
        ariaLabel="Task chat messages"
        dependencies={[allEvents]}
        emptyState={
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
            <IconMessageChatbot className="size-8 opacity-50" />
            <p>Manage your tasks</p>
            <p className="text-xs opacity-70">
              Get help researching issues and creating and working with tasks
            </p>
          </div>
        }
      >
        {hasContent ?
          <EventList
            events={allEvents}
            loadingIndicator={
              isLoading && !streamingMessage ?
                <div
                  className="flex items-center justify-start px-4 py-4"
                  aria-label="Thinking spinner"
                  data-testid="thinking-spinner"
                >
                  <TopologySpinner />
                </div>
              : null
            }
          />
        : null}
      </ContentStreamContainer>

      <div className="border-border border-t p-3">
        {error && <div className="text-status-error pb-2 text-xs">Error: {error}</div>}
        <ChatInput
          ref={chatInputRef}
          onSubmit={handleSendMessage}
          disabled={!isConnected || isLoading}
          placeholder={inputPlaceholder}
          aria-label="Task chat input"
          storageKey={TASK_CHAT_INPUT_DRAFT_STORAGE_KEY}
        />
      </div>
    </div>
  )
}

/**  Props for TaskChatPanel component. */
export type TaskChatPanelProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** Optional callback when close button is clicked */
  onClose?: () => void
}
