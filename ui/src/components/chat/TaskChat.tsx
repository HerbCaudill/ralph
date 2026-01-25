import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { EventList, useEventListState } from "@/components/events/EventList"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { cn } from "@/lib/utils"
import type { ChatEvent } from "@/types"
import { IconMessageChatbot, IconTrash, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useRef } from "react"
import { ChatInput, type ChatInputHandle } from "./ChatInput"
import { TaskChatHistoryDropdown } from "./TaskChatHistoryDropdown"

/**
 * Presentational component for task chat.
 *
 * This is a pure component that receives all data via props.
 * It handles rendering the chat UI including messages, input, and controls.
 * Business logic and store access are handled by the parent controller.
 */
export function TaskChat({
  className,
  events,
  isLoading,
  isDisabled,
  error,
  placeholder,
  storageKey,
  loadingJustCompleted,
  onSendMessage,
  onClearHistory,
  onClose,
  onLoadingComplete,
}: TaskChatProps) {
  const chatInputRef = useRef<ChatInputHandle>(null)

  // Use the shared EventList state hook for content detection
  const { hasContent, streamingMessage } = useEventListState(events)

  // Focus input after loading completes
  useEffect(() => {
    if (loadingJustCompleted) {
      chatInputRef.current?.focus()
      onLoadingComplete?.()
    }
  }, [loadingJustCompleted, onLoadingComplete])

  const handleSendMessage = useCallback(
    (message: string) => {
      onSendMessage(message)
    },
    [onSendMessage],
  )

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
            onClick={onClearHistory}
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
        dependencies={[events]}
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
            events={events}
            loadingIndicator={
              isLoading && !streamingMessage ?
                <div
                  className="flex items-center justify-start px-4 py-4"
                  aria-label="Task chat is loading"
                  data-testid="task-chat-loading-spinner"
                >
                  <TopologySpinner />
                </div>
              : hasContent ?
                <div
                  className="flex items-center justify-start px-4 py-4"
                  aria-label="Task chat is idle"
                  data-testid="task-chat-idle-spinner"
                >
                  <TopologySpinner stopped />
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
          disabled={isDisabled}
          placeholder={placeholder}
          aria-label="Task chat input"
          storageKey={storageKey}
        />
      </div>
    </div>
  )
}

/** Props for TaskChat presentational component. */
export type TaskChatProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** All chat events to display (user messages + SDK events) */
  events: ChatEvent[]
  /** Whether a message is currently being processed */
  isLoading: boolean
  /** Whether the input should be disabled */
  isDisabled: boolean
  /** Current error message, if any */
  error: string | null
  /** Placeholder text for the input */
  placeholder: string
  /** Storage key for persisting input drafts */
  storageKey: string
  /** Whether loading just completed (triggers focus) */
  loadingJustCompleted: boolean
  /** Handler for sending a message */
  onSendMessage: (message: string) => void
  /** Handler for clearing chat history */
  onClearHistory: () => void
  /** Optional callback when close button is clicked */
  onClose?: () => void
  /** Callback when loading complete focus has been handled */
  onLoadingComplete?: () => void
}
