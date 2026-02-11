import { IconMessage, IconMessagePlus, IconX } from "@tabler/icons-react"
import { Button } from "@herbcaudill/components"
import { AgentView, ChatInput, SessionPicker } from "@herbcaudill/agent-view"
import type {
  ChatEvent,
  AgentViewToolOutputControl,
  SessionIndexEntry,
  ChatInputHandle,
} from "@herbcaudill/agent-view"
import type { RefObject } from "react"

/**
 * Side panel for task-focused chat with the agent.
 * Used when clicking on a task to discuss it.
 */
export function TaskChatPanel({
  taskId,
  taskTitle,
  events,
  isStreaming,
  sessionId,
  sessions,
  toolOutput,
  onSendMessage,
  onSessionSelect,
  onNewSession,
  onClose,
  inputRef,
}: TaskChatPanelProps) {
  const header = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <IconMessage size={18} stroke={1.5} className="text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">Task chat</span>
          {taskTitle && (
            <span className="max-w-[300px] truncate text-xs text-muted-foreground">
              {taskTitle}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onNewSession} className="font-normal" aria-label="New chat">
          <IconMessagePlus size={18} stroke={1.5} />
          New chat
        </Button>
        {sessions.length > 0 && (
          <SessionPicker
            sessions={sessions}
            currentSessionId={sessionId ?? undefined}
            onSelectSession={onSessionSelect}
            disabled={isStreaming}
          />
        )}
        {taskId && (
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close chat panel"
          >
            <IconX size={18} stroke={1.5} />
          </button>
        )}
      </div>
    </div>
  )

  const emptyState = (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <IconMessage size={48} stroke={1.5} />
        <p className="text-center text-sm">
          {taskId ? "Start a conversation about this task." : "Start a conversation."}
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AgentView
        events={events}
        isStreaming={isStreaming}
        header={header}
        emptyState={emptyState}
        className="min-h-0 flex-1"
        context={toolOutput ? { toolOutput } : undefined}
      />

      {/* Chat input - outside AgentView (ChatInput has its own border-t) */}
      <div className="shrink-0">
        <ChatInput
          ref={inputRef}
          onSend={onSendMessage}
          disabled={false}
          placeholder={taskId ? "Ask about this task" : "Send a message"}
          storageKey={taskId ? `task-chat-draft-${taskId}` : "task-chat-draft"}
        />
      </div>
    </div>
  )
}

export type TaskChatPanelProps = {
  /** ID of the task being discussed. If null, the panel renders nothing. */
  taskId: string | null
  /** Title of the task for display in the header. */
  taskTitle?: string
  /** Chat events to display. */
  events: ChatEvent[]
  /** Whether the agent is currently streaming a response. */
  isStreaming: boolean
  /** Current session ID. */
  sessionId: string | null
  /** List of available sessions for the session picker. */
  sessions: SessionIndexEntry[]
  /** Tool output visibility control (from global UI state). */
  toolOutput?: AgentViewToolOutputControl
  /** Callback when user sends a message. */
  onSendMessage: (message: string) => void
  /** Callback when a session is selected from the picker. */
  onSessionSelect: (sessionId: string) => void
  /** Callback when new session button is clicked. */
  onNewSession: () => void
  /** Callback to close the panel. */
  onClose: () => void
  /** Ref to focus the task chat input. */
  inputRef?: RefObject<ChatInputHandle | null>
}
