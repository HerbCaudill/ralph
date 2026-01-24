/**  Entry stored in the beads registry file (~/.beads/registry.json). */
export interface RegistryEntry {
  workspace_path: string
  socket_path: string
  database_path: string
  pid: number
  version: string
  started_at: string
}

/**  Workspace info with additional metadata for the UI. */
export interface WorkspaceInfo {
  path: string
  name: string
  database: string
  pid: number
  version: string
  startedAt: string
  isActive?: boolean
}
