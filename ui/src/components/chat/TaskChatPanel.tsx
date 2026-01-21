import { useCallback, useEffect, useRef, useState } from "react"
import { IconChevronDown, IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
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
import { ToolUseCard } from "@/components/events/ToolUseCard"
import type { TaskChatMessage, TaskChatToolUse, ToolName, ToolUseEvent } from "@/types"

// Helper to convert TaskChatToolUse to ToolUseEvent for rendering
function toToolUseEvent(toolUse: TaskChatToolUse): ToolUseEvent {
  return {
    type: "tool_use",
    timestamp: Date.now(),
    tool: toolUse.tool as ToolName,
    input: toolUse.input,
    output: toolUse.output,
    error: toolUse.error,
    status: toolUse.status,
  }
}

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

  const chatInputRef = useRef<ChatInputHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const streamingText = useAppStore(selectTaskChatStreamingText)
  const setStreamingText = useAppStore(state => state.setTaskChatStreamingText)

  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const threshold = 50
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return scrollBottom <= threshold
  }, [])

  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    setIsAtBottom(atBottom)

    if (atBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }, [checkIsAtBottom, autoScroll])

  const handleUserScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    if (!atBottom) {
      setAutoScroll(false)
    }
  }, [checkIsAtBottom])

  // Auto-scroll to bottom when new messages or tool uses arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, streamingText, toolUses, autoScroll])

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

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

  const handleSendMessage = useCallback(
    async (message: string) => {
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
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onWheel={handleUserScroll}
          onTouchMove={handleUserScroll}
          className="bg-background h-full overflow-y-auto py-2"
          role="log"
          aria-label="Task chat messages"
          aria-live="polite"
        >
          {messages.length === 0 && !streamingText && toolUses.length === 0 ?
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
              <IconMessageChatbot className="size-8 opacity-50" />
              <p>Ask questions about your tasks</p>
              <p className="text-xs opacity-70">
                Get help organizing, prioritizing, and managing your issues
              </p>
            </div>
          : <>
              {messages.map(message =>
                message.role === "user" ?
                  <UserMessageBubble key={message.id} message={message} />
                : <AssistantMessageBubble key={message.id} message={message} />,
              )}
              {/* Tool uses - shown during and after processing, cleared on next user message */}
              {toolUses.length > 0 && (
                <div className="py-1">
                  {toolUses.map(toolUse => (
                    <ToolUseCard
                      key={toolUse.toolUseId}
                      event={toToolUseEvent(toolUse)}
                      className="text-sm"
                    />
                  ))}
                </div>
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
          }
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "bg-primary text-primary-foreground absolute right-4 bottom-4 rounded-full p-2 shadow-lg transition-opacity hover:opacity-90",
              "flex items-center gap-1.5",
            )}
            aria-label="Scroll to latest messages"
          >
            <IconChevronDown className="size-4" />
            <span className="pr-1 text-xs font-medium">Latest</span>
          </button>
        )}
      </div>

      <div className="border-border border-t p-3">
        {error && <div className="text-status-error pb-2 text-xs">Error: {error}</div>}
        <ChatInput
          ref={chatInputRef}
          onSubmit={handleSendMessage}
          disabled={!isConnected || isLoading}
          placeholder={inputPlaceholder}
          aria-label="Task chat input"
        />
      </div>
    </div>
  )
}

export type TaskChatPanelProps = {
  className?: string
  onClose?: () => void
}
