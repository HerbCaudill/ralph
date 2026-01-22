import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"
import { useStreamingState } from "@/hooks/useStreamingState"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import { cn } from "@/lib/utils"
import {
  selectIsConnected,
  selectTaskChatEvents,
  selectTaskChatLoading,
  selectTaskChatMessages,
  selectTaskChatToolUses,
  useAppStore,
} from "@/store"
import type { RalphEvent, TaskChatMessage, TaskChatToolUse } from "@/types"
import { IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ToolUseCard } from "@/components/events/ToolUseCard"
import { AssistantMessageBubble } from "./AssistantMessageBubble"
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
  // Tool uses from the legacy model (still used by tests and some code paths)
  const toolUses = useAppStore(selectTaskChatToolUses)
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

  // Build tool results map from user events (tool_result blocks)
  const toolResults = useMemo(() => {
    const results = new Map<string, { output?: string; error?: string }>()
    for (const event of completedEvents) {
      if (event.type === "user") {
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

  // Create unified content list: user messages + assistant events + tool uses, sorted properly
  const contentItems = useMemo((): ContentItem[] => {
    const items: ContentItem[] = []

    // Add user messages
    for (const msg of userMessages) {
      if (msg.role === "user") {
        items.push({
          type: "user_message",
          data: msg,
          timestamp: msg.timestamp,
          sequence: msg.sequence,
        })
      } else if (msg.role === "assistant") {
        // Assistant messages from the legacy model
        items.push({
          type: "assistant_message",
          data: msg,
          timestamp: msg.timestamp,
          sequence: msg.sequence,
        })
      }
    }

    // Add tool uses from the legacy model (taskChatToolUses)
    for (const toolUse of toolUses) {
      items.push({
        type: "tool_use",
        data: toolUse,
        timestamp: toolUse.timestamp,
        sequence: toolUse.sequence,
      })
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

    // Sort by sequence first (if available), then by timestamp
    // Items without sequence come before items with sequence (user messages before tool uses)
    return items.sort((a, b) => {
      const aSeq = a.sequence
      const bSeq = b.sequence

      // If one has sequence and other doesn't, the one without comes first
      if (aSeq === undefined && bSeq !== undefined) return -1
      if (aSeq !== undefined && bSeq === undefined) return 1

      // If both have sequence, sort by sequence
      if (aSeq !== undefined && bSeq !== undefined) {
        if (aSeq !== bSeq) return aSeq - bSeq
      }

      // Fall back to timestamp
      return a.timestamp - b.timestamp
    })
  }, [userMessages, toolUses, completedEvents])

  const hasContent = contentItems.length > 0 || streamingMessage !== null

  /**
   * Extract streaming text from the streaming message content blocks.
   */
  const streamingText = useMemo(() => {
    if (!streamingMessage) return null
    const textBlocks = streamingMessage.contentBlocks.filter(b => b.type === "text")
    if (textBlocks.length === 0) return null
    return textBlocks.map(b => b.text).join("")
  }, [streamingMessage])

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
        dependencies={[contentItems, streamingText]}
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
            {/* Render messages and tool uses interleaved by timestamp/sequence */}
            {contentItems.map(item => {
              switch (item.type) {
                case "user_message":
                  return <UserMessageBubble key={item.data.id} message={item.data} />
                case "assistant_message":
                  return <AssistantMessageBubble key={item.data.id} message={item.data} />
                case "tool_use":
                  return (
                    <ToolUseCard
                      key={item.data.toolUseId}
                      event={{
                        type: "tool_use",
                        timestamp: item.data.timestamp,
                        tool: item.data.tool as any,
                        input: item.data.input,
                        output: item.data.output,
                        error: item.data.error,
                        status: item.data.status,
                      }}
                      className="text-sm"
                    />
                  )
                case "assistant_event":
                  return (
                    <AssistantEventContent
                      key={`assistant-${item.timestamp}`}
                      event={item.data}
                      toolResults={toolResults}
                    />
                  )
                default:
                  return null
              }
            })}
            {/* Streaming response */}
            {streamingText && (
              <AssistantMessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingText,
                  timestamp: Date.now(),
                }}
              />
            )}
            {/* Loading indicator */}
            {isLoading && !streamingText && (
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
  sequence?: number
}
type AssistantMessageItem = {
  type: "assistant_message"
  data: TaskChatMessage
  timestamp: number
  sequence?: number
}
type ToolUseItem = {
  type: "tool_use"
  data: TaskChatToolUse
  timestamp: number
  sequence?: number
}
type AssistantEventItem = {
  type: "assistant_event"
  data: RalphEvent
  timestamp: number
  sequence?: number
}
type ContentItem = UserMessageItem | AssistantMessageItem | ToolUseItem | AssistantEventItem

/**
 * Renders the content of an assistant event, extracting text and tool uses.
 */
function AssistantEventContent({
  event,
  toolResults,
}: {
  event: RalphEvent
  toolResults: Map<string, { output?: string; error?: string }>
}) {
  const content = (event as any).message?.content
  if (!Array.isArray(content)) return null

  return (
    <>
      {content.map((block: any, index: number) => {
        if (block.type === "text" && block.text) {
          return (
            <AssistantMessageBubble
              key={`text-${event.timestamp}-${index}`}
              message={{
                id: `text-${event.timestamp}-${index}`,
                role: "assistant",
                content: block.text,
                timestamp: event.timestamp,
              }}
            />
          )
        }
        if (block.type === "tool_use") {
          const result = toolResults.get(block.id)
          return (
            <ToolUseCard
              key={block.id}
              event={{
                type: "tool_use",
                timestamp: event.timestamp,
                tool: block.name as any,
                input: block.input,
                output: result?.output,
                error: result?.error,
                status:
                  result ?
                    result.error ?
                      "error"
                    : "success"
                  : "pending",
              }}
              className="text-sm"
            />
          )
        }
        return null
      })}
    </>
  )
}

/**
 * Props for TaskChatPanel component.
 */
export type TaskChatPanelProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** Optional callback when close button is clicked */
  onClose?: () => void
}
