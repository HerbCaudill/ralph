import {
  TaskSidebarController,
  type TaskSidebarControllerProps,
} from "./tasks/TaskSidebarController"

/**
 * Sidebar panel containing task list and quick task input.
 *
 * @deprecated Use TaskSidebarController instead. This component is kept for backward compatibility.
 *
 * The TaskSidebarController provides the same functionality and uses the controller/presentational
 * pattern for better testability and separation of concerns.
 */
export function TasksSidebarPanel(props: TasksSidebarPanelProps) {
  return <TaskSidebarController {...props} />
}

/**
 * Props for TasksSidebarPanel component.
 * @deprecated Use TaskSidebarControllerProps instead.
 */
export type TasksSidebarPanelProps = TaskSidebarControllerProps
