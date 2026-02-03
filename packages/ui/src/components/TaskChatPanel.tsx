import { IconMessage, IconX } from "@tabler/icons-react"
import { AgentView, AgentViewProvider, ChatInput } from "@herbcaudill/agent-view"
import type { ChatEvent } from "@herbcaudill/agent-view"

/**
 * Side panel for task-focused chat with the agent.
 * Used when clicking on a task to discuss it.
 */
export function TaskChatPanel({
  taskId,
  taskTitle,
  events,
  isStreaming,
  onSendMessage,
  onClose,
}: TaskChatPanelProps) {
  if (!taskId) {
    return null
  }

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
      <button
        onClick={onClose}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close chat panel"
      >
        <IconX size={18} stroke={1.5} />
      </button>
    </div>
  )

  const footer = (
    <div className="border-t border-border p-4">
      <ChatInput onSend={onSendMessage} disabled={isStreaming} placeholder="Ask about this task" />
    </div>
  )

  const emptyState = (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <IconMessage size={48} stroke={1.5} />
        <p className="text-center text-sm">Start a conversation about this task.</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <AgentViewProvider>
        <AgentView
          events={events}
          isStreaming={isStreaming}
          header={header}
          footer={footer}
          emptyState={emptyState}
          className="flex-1"
        />
      </AgentViewProvider>
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
  /** Callback when user sends a message. */
  onSendMessage: (message: string) => void
  /** Callback to close the panel. */
  onClose: () => void
}
