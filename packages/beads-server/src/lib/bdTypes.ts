/** Status of an issue. */
export type IssueStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

/** An issue from the beads database. */
export interface BdIssue {
  id: string
  title: string
  description?: string
  status: IssueStatus
  priority: number
  issue_type: string
  assignee?: string
  owner?: string
  created_at: string
  created_by?: string
  updated_at: string
  closed_at?: string
  parent?: string
  labels?: string[]
  dependency_count?: number
  dependent_count?: number
  dependencies?: BdDependency[]
  dependents?: BdDependency[]
  blocked_by?: string[]
  blocked_by_count?: number
}

/** A dependency relationship between issues. */
export interface BdDependency extends BdIssue {
  dependency_type: string
}

/** Options for listing issues. */
export interface BdListOptions {
  limit?: number
  status?: IssueStatus
  priority?: number
  type?: string
  assignee?: string
  parent?: string
  ready?: boolean
  all?: boolean
}

/** Options for creating a new issue. */
export interface BdCreateOptions {
  title: string
  description?: string
  priority?: number
  type?: string
  assignee?: string
  parent?: string
  labels?: string[]
}

/** Options for updating an existing issue. */
export interface BdUpdateOptions {
  title?: string
  description?: string
  priority?: number
  status?: IssueStatus
  type?: string
  assignee?: string
  parent?: string
  addLabels?: string[]
  removeLabels?: string[]
}

/** Information about the beads database. */
export interface BdInfo {
  database_path: string
  issue_count: number
  mode: string
  daemon_connected: boolean
  daemon_status?: string
  daemon_version?: string
  socket_path?: string
  config?: Record<string, string>
}

/** Result of a label operation. */
export interface BdLabelResult {
  issue_id: string
  label: string
  status: "added" | "removed" | "already_exists" | "not_found"
}

/** Result of a dependency operation. */
export interface BdDepResult {
  issue_id: string
  depends_on_id: string
  status: "added" | "removed"
  type?: string
}

/** A comment on an issue. */
export interface BdComment {
  id: number
  issue_id: string
  author: string
  text: string
  created_at: string
}

/** Type of mutation event from the beads daemon. */
export type MutationType =
  | "create"
  | "update"
  | "delete"
  | "comment"
  | "status"
  | "bonded"
  | "squashed"
  | "burned"

/** A mutation event from the beads daemon. */
export interface MutationEvent {
  Timestamp: string
  Type: MutationType
  IssueID: string
  Title?: string
  old_status?: string
  new_status?: string
  parent_id?: string
  Actor?: string
}
