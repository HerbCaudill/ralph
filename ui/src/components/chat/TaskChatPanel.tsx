import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"
import { useStreamingState } from "@/hooks/useStreamingState"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import { cn } from "@/lib/utils"
import {
  selectIsConnected,
  selectTaskChatEvents,
  selectTaskChatLoading,
  selectTaskChatMessages,
  useAppStore,
} from "@/store"
import type { AssistantContentBlock, RalphEvent, TaskChatMessage } from "@/types"
import { IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StreamingContentRenderer } from "@/components/events/StreamingContentRenderer"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import { UserMessageBubble } from "./UserMessageBubble"

/**
 * Task chat panel for task management conversations with Claude.
 * Displays a chat interface with message history and input.
 *
 * Uses the unified event model (same as EventStream) for rendering assistant content,
 * which preserves proper interleaving of text and tool uses.
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

  // Process events using the same hook as EventStream
  const { completedEvents, streamingMessage } = useStreamingState(taskChatEvents)

  // Build tool results map from user/tool_result events (same pattern as EventStream)
  const toolResults = useMemo(() => {
    const results = new Map<string, { output?: string; error?: string }>()
    for (const event of completedEvents) {
      if (isToolResultEvent(event)) {
        const content = (event as any).message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "tool_result" && item.tool_use_id) {
              results.set(item.tool_use_id, {
                output: typeof item.content === "string" ? item.content : undefined,
                error:
                  item.is_error ?
                    typeof item.content === "string" ?
                      item.content
                    : "Error"
                  : undefined,
              })
            }
          }
        }
      }
    }
    return results
  }, [completedEvents])

  // Create unified content list: user messages + assistant events, sorted by timestamp
  // User messages are explicitly typed by the user (rendered with UserMessageBubble)
  // Assistant events come from SDK events with proper interleaving (rendered with renderEventContentBlock)
  const contentItems = useMemo((): ContentItem[] => {
    const items: ContentItem[] = []

    // Add user messages (only user role - assistant content comes from SDK events)
    for (const msg of userMessages) {
      if (msg.role === "user") {
        items.push({
          type: "user_message",
          data: msg,
          timestamp: msg.timestamp,
        })
      }
    }

    // Add assistant events from SDK events (text + tool use interleaved)
    for (const event of completedEvents) {
      if (event.type === "assistant") {
        items.push({
          type: "assistant_event",
          data: event,
          timestamp: event.timestamp,
        })
      }
    }

    // Sort by timestamp (user messages and assistant events)
    return items.sort((a, b) => a.timestamp - b.timestamp)
  }, [userMessages, completedEvents])

  const hasContent = contentItems.length > 0 || streamingMessage !== null

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
    : "Send a message to Ralph"

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <IconMessageChatbot className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Task Chat</span>
        </div>
        <div className="flex items-center gap-1">
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
        dependencies={[contentItems, streamingMessage]}
        emptyState={
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
            <IconMessageChatbot className="size-8 opacity-50" />
            <p>Ask questions about your tasks</p>
            <p className="text-xs opacity-70">
              Get help organizing, prioritizing, and managing your issues
            </p>
          </div>
        }
      >
        {hasContent ?
          <>
            {/* Render user messages and assistant events using shared rendering */}
            {contentItems.map(item => {
              switch (item.type) {
                case "user_message":
                  return <UserMessageBubble key={item.data.id} message={item.data} />
                case "assistant_event": {
                  // Use shared renderEventContentBlock for proper interleaved rendering
                  const content = (item.data as any).message?.content as
                    | AssistantContentBlock[]
                    | undefined
                  if (!content || content.length === 0) return null
                  return (
                    <div key={`assistant-${item.timestamp}`}>
                      {content.map((block, index) =>
                        renderEventContentBlock(block, index, item.timestamp, toolResults),
                      )}
                    </div>
                  )
                }
                default:
                  return null
              }
            })}
            {/* Streaming response using shared StreamingContentRenderer */}
            {streamingMessage && <StreamingContentRenderer message={streamingMessage} />}
            {/* Loading indicator */}
            {isLoading && !streamingMessage && (
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
                <span className="text-muted-foreground text-xs">Thinking...</span>
              </div>
            )}
          </>
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

/**
 * Content item types for unified rendering in the chat timeline.
 */
type UserMessageItem = {
  type: "user_message"
  data: TaskChatMessage
  timestamp: number
}
type AssistantEventItem = {
  type: "assistant_event"
  data: RalphEvent
  timestamp: number
}
type ContentItem = UserMessageItem | AssistantEventItem

/**
 * Props for TaskChatPanel component.
 */
export type TaskChatPanelProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** Optional callback when close button is clicked */
  onClose?: () => void
}
