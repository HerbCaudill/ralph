/** Time window filter for closed tasks. */
export type ClosedTasksTimeFilter =
  | "past_hour"
  | "past_4_hours"
  | "past_day"
  | "past_week"
  | "all_time"

/** Task lifecycle status. */
export type TaskStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

/** Dependency metadata for a task. */
export interface TaskDependency {
  /** Dependent task ID. */
  id: string
  /** Current status of the dependency. */
  status: TaskStatus
  /** Dependency relationship type. */
  dependency_type: string
}

/** Core task data from beads. */
export interface Task {
  /** Task identifier. */
  id: string
  /** Task title. */
  title: string
  /** Task description. */
  description?: string
  /** Task status. */
  status: TaskStatus
  /** Priority value (lower is higher priority). */
  priority?: number
  /** Issue type from beads. */
  issue_type?: string
  /** Parent task ID. */
  parent?: string
  /** Creation timestamp. */
  created_at?: string
  /** Close timestamp. */
  closed_at?: string
  /** Task dependencies. */
  dependencies?: TaskDependency[]
  /** IDs of issues that block this issue (from bd blocked command). */
  blocked_by?: string[]
  /** Number of issues blocking this issue (from bd blocked command). */
  blocked_by_count?: number
}

/** Task data used by UI components. */
export type TaskCardTask = Task & {
  /** Task labels. */
  labels?: string[]
}

/** Payload for updating a task. */
export type TaskUpdateData = {
  /** Updated title. */
  title?: string
  /** Updated description. */
  description?: string
  /** Updated status. */
  status?: TaskStatus
  /** Updated priority. */
  priority?: number
  /** Updated type. */
  type?: string
  /** Updated parent ID. */
  parent?: string | null
}

/** Task grouping buckets for list rendering. */
export type TaskGroup = "open" | "deferred" | "closed"

/** Task relationship data used in graphs. */
export interface RelatedTask {
  /** Related task ID. */
  id: string
  /** Related task title. */
  title: string
  /** Related task status. */
  status: TaskStatus
  /** Relationship type. */
  dependency_type?: string
}

/** Comment metadata for a task. */
export interface Comment {
  /** Comment ID. */
  id: number
  /** Associated task ID. */
  issue_id: string
  /** Comment author. */
  author: string
  /** Comment body text. */
  text: string
  /** Comment creation timestamp. */
  created_at: string
}

/** Node in a task hierarchy tree. */
export interface TaskTreeNode {
  /** Task data for this node. */
  task: TaskCardTask
  /** Child nodes (subtasks). */
  children: TaskTreeNode[]
}
