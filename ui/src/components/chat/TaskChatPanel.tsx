import { useCallback, useEffect, useRef, useState } from "react"
import { IconChevronDown, IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskChatMessages,
  selectTaskChatLoading,
  selectIsConnected,
  selectTaskChatStreamingText,
} from "@/store"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import { AssistantMessageBubble } from "./AssistantMessageBubble"
import { UserMessageBubble } from "./UserMessageBubble"
import { clearTaskChatHistory } from "@/lib/clearTaskChatHistory"
import { sendTaskChatMessage } from "@/lib/sendTaskChatMessage"
import type { TaskChatMessage } from "@/types"

/**
 * Task chat panel for task management conversations with Claude.
 * Displays a chat interface with message history and input.
 */
export function TaskChatPanel({ className, onClose }: TaskChatPanelProps) {
  const messages = useAppStore(selectTaskChatMessages)
  const isLoading = useAppStore(selectTaskChatLoading)
  const isConnected = useAppStore(selectIsConnected)
  const addMessage = useAppStore(state => state.addTaskChatMessage)
  const removeMessage = useAppStore(state => state.removeTaskChatMessage)
  const setLoading = useAppStore(state => state.setTaskChatLoading)
  const clearMessages = useAppStore(state => state.clearTaskChatMessages)

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

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, streamingText, autoScroll])

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
    [addMessage, setLoading, setStreamingText, removeMessage],
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

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="bg-background flex-1 overflow-y-auto py-2"
        role="log"
        aria-label="Task chat messages"
        aria-live="polite"
      >
        {messages.length === 0 && !streamingText ?
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Ask questions about your tasks
          </div>
        : <>
            {messages.map(message =>
              message.role === "user" ?
                <UserMessageBubble key={message.id} message={message} />
              : <AssistantMessageBubble key={message.id} message={message} />,
            )}
            {streamingText && (
              <AssistantMessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingText,
                  timestamp: 0,
                }}
              />
            )}
            {isLoading && (
              <div className="text-muted-foreground px-4 py-2 text-xs">Thinking...</div>
            )}
          </>
        }
      </div>

      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "bg-primary text-primary-foreground absolute right-4 bottom-20 rounded-full p-2 shadow-lg transition-opacity hover:opacity-90",
            "flex items-center gap-1.5",
          )}
          aria-label="Scroll to latest messages"
        >
          <IconChevronDown className="size-4" />
          <span className="pr-1 text-xs font-medium">Latest</span>
        </button>
      )}

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
