import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskChatMessages,
  selectTaskChatToolUses,
  selectTaskChatLoading,
  selectIsConnected,
  selectTaskChatStreamingText,
} from "@/store"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import { AssistantMessageBubble } from "./AssistantMessageBubble"
import { UserMessageBubble } from "./UserMessageBubble"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import { TASK_CHAT_INPUT_DRAFT_STORAGE_KEY } from "@/constants"
import { ToolUseCard } from "@/components/events/ToolUseCard"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { toToolUseEvent } from "@/lib/toToolUseEvent"
import type { TaskChatMessage, TaskChatToolUse } from "@/types"

/**
 * Task chat panel for task management conversations with Claude.
 * Displays a chat interface with message history and input.
 */
export function TaskChatPanel({ className, onClose }: TaskChatPanelProps) {
  const messages = useAppStore(selectTaskChatMessages)
  const toolUses = useAppStore(selectTaskChatToolUses)
  const isLoading = useAppStore(selectTaskChatLoading)
  const isConnected = useAppStore(selectIsConnected)
  const addMessage = useAppStore(state => state.addTaskChatMessage)
  const removeMessage = useAppStore(state => state.removeTaskChatMessage)
  const setLoading = useAppStore(state => state.setTaskChatLoading)
  const clearMessages = useAppStore(state => state.clearTaskChatMessages)
  const clearToolUses = useAppStore(state => state.clearTaskChatToolUses)
  const streamingText = useAppStore(selectTaskChatStreamingText)
  const setStreamingText = useAppStore(state => state.setTaskChatStreamingText)

  const chatInputRef = useRef<ChatInputHandle>(null)
  const [error, setError] = useState<string | null>(null)

  // Create a unified content array that interleaves messages and tool uses
  // Messages always come before tool uses within the same turn
  const contentBlocks = useMemo((): ContentBlock[] => {
    const messageBlocks: ContentBlock[] = messages.map(m => ({ type: "message", data: m }))
    const toolUseBlocks: ContentBlock[] = toolUses.map(t => ({ type: "toolUse", data: t }))
    const allBlocks = [...messageBlocks, ...toolUseBlocks]

    // Sort by sequence number if available, then by timestamp as fallback
    // Sequence numbers are assigned server-side to ensure correct ordering within a turn
    return allBlocks.sort((a, b) => {
      const seqA = a.data.sequence
      const seqB = b.data.sequence

      // If both have sequence numbers, sort by sequence
      if (seqA !== undefined && seqB !== undefined) {
        return seqA - seqB
      }

      // If only one has a sequence number, items without sequence come first (messages)
      // This ensures user messages (which don't have sequence) appear before tool uses
      if (seqA !== undefined && seqB === undefined) return 1
      if (seqA === undefined && seqB !== undefined) return -1

      // Fall back to timestamp
      return a.data.timestamp - b.data.timestamp
    })
  }, [messages, toolUses])

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
      setStreamingText("")
      clearToolUses() // Clear tool uses from previous turn

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
        setStreamingText("")
        setError(errorMessage)
      }
    },
    [addMessage, setLoading, setStreamingText, clearToolUses, removeMessage],
  )

  /**
   * Handle clearing the chat history.
   */
  const handleClearHistory = useCallback(async () => {
    setLoading(true)
    setStreamingText("")
    setError(null)

    const result = await clearTaskChatHistory()

    if (result.ok) {
      clearMessages()
    }
    setLoading(false)
  }, [clearMessages, setLoading, setStreamingText])

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
        dependencies={[contentBlocks, streamingText]}
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
        {contentBlocks.length > 0 || streamingText ?
          <>
            {/* Render messages and tool uses interleaved by timestamp */}
            {contentBlocks.map(block =>
              block.type === "message" ?
                block.data.role === "user" ?
                  <UserMessageBubble key={block.data.id} message={block.data} />
                : <AssistantMessageBubble key={block.data.id} message={block.data} />
              : <ToolUseCard
                  key={block.data.toolUseId}
                  event={toToolUseEvent(block.data)}
                  className="text-sm"
                />,
            )}
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
            {isLoading && !streamingText && toolUses.length === 0 && (
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
 * Content block types for unified rendering.
 */
type MessageBlock = { type: "message"; data: TaskChatMessage }

/**
 * Tool use block type for unified rendering.
 */
type ToolUseBlock = { type: "toolUse"; data: TaskChatToolUse }

/**
 * Union type for message and tool use blocks.
 */
type ContentBlock = MessageBlock | ToolUseBlock

/**
 * Props for TaskChatPanel component.
 */
export type TaskChatPanelProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** Optional callback when close button is clicked */
  onClose?: () => void
}
