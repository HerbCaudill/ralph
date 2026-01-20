import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskChatMessages,
  selectTaskChatLoading,
  selectIsConnected,
  selectTaskChatStreamingText,
  type TaskChatMessage,
} from "@/store"
import { useCallback, useEffect, useRef, useState } from "react"
import { IconChevronDown, IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "@/components/ui/code-block"
import { TaskIdLink } from "@/components/ui/TaskIdLink"
import { useTheme } from "@/hooks/useTheme"
import type { Components } from "react-markdown"
import type { ReactNode } from "react"

// Types

export interface TaskChatPanelProps {
  className?: string
  /** Callback when close button is clicked */
  onClose?: () => void
}

// API Functions

async function sendTaskChatMessage(message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/task-chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message" }
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

// Message Components

interface UserMessageProps {
  message: TaskChatMessage
  className?: string
}

function UserMessageBubble({ message, className }: UserMessageProps) {
  return (
    <div className={cn("flex justify-end py-2 pr-4 pl-12", className)}>
      <div className="bg-muted/60 max-w-[85%] rounded-lg px-4 py-2.5">
        <p className="text-foreground text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

interface AssistantMessageProps {
  message: TaskChatMessage
  className?: string
}

function AssistantMessageBubble({ message, className }: AssistantMessageProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Helper to process children and replace text nodes with TaskIdLink
  const processChildren = (children: ReactNode): ReactNode => {
    if (typeof children === "string") {
      return <TaskIdLink>{children}</TaskIdLink>
    }
    return children
  }

  const components: Components = {
    // Process text in paragraph elements
    p(props) {
      const { children, ...rest } = props
      return <p {...rest}>{processChildren(children)}</p>
    },
    // Process text in list items
    li(props) {
      const { children, ...rest } = props
      return <li {...rest}>{processChildren(children)}</li>
    },
    // Process text in strong elements
    strong(props) {
      const { children, ...rest } = props
      return <strong {...rest}>{processChildren(children)}</strong>
    },
    // Process text in emphasis elements
    em(props) {
      const { children, ...rest } = props
      return <em {...rest}>{processChildren(children)}</em>
    },
    code(props) {
      const { children, className: codeClassName, ...rest } = props
      // Check if this is a code block (inside a pre) by looking at the className
      // react-markdown adds language-xxx class for fenced code blocks
      const match = /language-(\w+)/.exec(codeClassName || "")

      // If it has a language class, it's a fenced code block
      if (match) {
        const language = match[1]
        const code = String(children).replace(/\n$/, "")
        return <CodeBlock code={code} language={language} isDark={isDark} />
      }

      // Otherwise it's inline code - process for task IDs
      return (
        <code className={codeClassName} {...rest}>
          {processChildren(children)}
        </code>
      )
    },
    pre(props) {
      const { children } = props
      // If the child is already a CodeBlock, just render it directly
      // Otherwise wrap in pre as normal
      return <>{children}</>
    },
  }

  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none flex-1 font-serif text-sm",
          "prose-p:my-1 prose-p:leading-snug",
          "prose-strong:font-medium",
          "prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline",
          "prose-code:text-muted-foreground prose-code:text-xs prose-code:font-normal prose-code:font-mono",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:my-2 prose-pre:border-0 prose-pre:bg-transparent prose-pre:p-0",
          "prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// TaskChatPanel Component

/**
 * Task chat panel for task management conversations with Claude.
 * Displays a chat interface with message history and input.
 */
export function TaskChatPanel({ className, onClose }: TaskChatPanelProps) {
  const messages = useAppStore(selectTaskChatMessages)
  const isLoading = useAppStore(selectTaskChatLoading)
  const isConnected = useAppStore(selectIsConnected)
  const addMessage = useAppStore(state => state.addTaskChatMessage)
  const setLoading = useAppStore(state => state.setTaskChatLoading)
  const clearMessages = useAppStore(state => state.clearTaskChatMessages)

  const chatInputRef = useRef<ChatInputHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const streamingText = useAppStore(selectTaskChatStreamingText)
  const setStreamingText = useAppStore(state => state.setTaskChatStreamingText)

  // Check if user is at the bottom of the scroll container
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const threshold = 50 // pixels from bottom to consider "at bottom"
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return scrollBottom <= threshold
  }, [])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    setIsAtBottom(atBottom)

    // Re-enable auto-scroll when user scrolls to bottom
    if (atBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }, [checkIsAtBottom, autoScroll])

  // Handle user interaction (wheel/touch) to detect intentional scrolling
  const handleUserScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    // If user scrolls away from bottom, disable auto-scroll
    if (!atBottom) {
      setAutoScroll(false)
    }
  }, [checkIsAtBottom])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, streamingText, autoScroll])

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  // Track previous loading state to detect when loading completes
  const wasLoadingRef = useRef(false)

  // Focus input when loading completes (user can type again)
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Loading just finished, focus the input
      chatInputRef.current?.focus()
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (message: string) => {
      // Add user message to local state immediately
      const userMessage: TaskChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: Date.now(),
      }
      addMessage(userMessage)
      setLoading(true)
      setStreamingText("")

      // Send to server - loading state and response handled via WebSocket events
      const result = await sendTaskChatMessage(message)

      if (!result.ok) {
        // API request itself failed (network error, etc.)
        // Server errors come via WebSocket task-chat:error event
        setLoading(false)
        const errorMessage: TaskChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${result.error || "Failed to send message"}`,
          timestamp: Date.now(),
        }
        addMessage(errorMessage)
      }
      // Note: The assistant message is added via WebSocket event (task-chat:message)
      // Loading state is cleared via WebSocket event (task-chat:status or task-chat:message)
      // Input will be focused via useEffect when loading completes
    },
    [addMessage, setLoading, setStreamingText],
  )

  // Handle clearing chat history
  const handleClearHistory = useCallback(async () => {
    const result = await clearTaskChatHistory()
    if (result.ok) {
      clearMessages()
      setStreamingText("")
    }
  }, [clearMessages, setStreamingText])

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <IconMessageChatbot className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Task Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
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
              title="Close (Ctrl+T)"
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
          {messages.length === 0 && !streamingText ?
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
          </button>
        )}
      </div>

      {/* Chat input */}
      <div className="border-border border-t p-4">
        <ChatInput
          ref={chatInputRef}
          onSubmit={handleSendMessage}
          disabled={!isConnected || isLoading}
          placeholder={
            !isConnected ? "Connecting..."
            : isLoading ?
              "Waiting for response..."
            : "Ask about your tasks..."
          }
          aria-label="Task chat input"
        />
      </div>
    </div>
  )
}
