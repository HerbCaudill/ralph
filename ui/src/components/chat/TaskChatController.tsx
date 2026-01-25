import { useTaskChat } from "@/hooks/useTaskChat"
import { TaskChat } from "./TaskChat"

/**
 * Controller component for TaskChat.
 *
 * Connects the useTaskChat hook to the TaskChat presentational component.
 * This is the entry point for using TaskChat in the application.
 */
export function TaskChatController({ className, onClose }: TaskChatControllerProps) {
  const {
    events,
    isLoading,
    isConnected,
    error,
    placeholder,
    storageKey,
    loadingJustCompleted,
    sendMessage,
    clearHistory,
    onLoadingComplete,
  } = useTaskChat()

  return (
    <TaskChat
      className={className}
      events={events}
      isLoading={isLoading}
      isDisabled={!isConnected || isLoading}
      error={error}
      placeholder={placeholder}
      storageKey={storageKey}
      loadingJustCompleted={loadingJustCompleted}
      onSendMessage={sendMessage}
      onClearHistory={clearHistory}
      onClose={onClose}
      onLoadingComplete={onLoadingComplete}
    />
  )
}

/** Props for TaskChatController component. */
export type TaskChatControllerProps = {
  /** Optional CSS class name to apply to the panel */
  className?: string
  /** Optional callback when close button is clicked */
  onClose?: () => void
}
