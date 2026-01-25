import { TaskChatController, type TaskChatControllerProps } from "./TaskChatController"

/**
 * Task chat panel for task management conversations with Claude.
 *
 * @deprecated Use TaskChatController instead. This component is kept for backward compatibility.
 *
 * The TaskChatController provides the same functionality and uses the controller/presentational
 * pattern for better testability and separation of concerns.
 */
export function TaskChatPanel(props: TaskChatPanelProps) {
  return <TaskChatController {...props} />
}

/**
 * Props for TaskChatPanel component.
 * @deprecated Use TaskChatControllerProps instead.
 */
export type TaskChatPanelProps = TaskChatControllerProps
