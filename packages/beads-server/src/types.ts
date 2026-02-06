/** Entry stored in the beads registry file (~/.beads/registry.json). */
export interface RegistryEntry {
  workspace_path: string
  socket_path: string
  database_path: string
  pid: number
  version: string
  started_at: string
}

/** Workspace info with additional metadata for the UI. */
export interface WorkspaceInfo {
  path: string
  name: string
  database: string
  pid: number
  version: string
  startedAt: string
  isActive?: boolean
}

/** Configuration for the beads server. */
export interface BeadsServerConfig {
  /** Hostname to listen on (default: "localhost") */
  host: string
  /** Port to listen on (default: 4243) */
  port: number
  /** Enable mutation polling for real-time task updates (default: true) */
  enableMutationPolling?: boolean
  /** Mutation polling interval in ms (default: 1000) */
  mutationPollingInterval?: number
}

/** WebSocket client with workspace subscription tracking. */
export interface WsClient {
  /** The WebSocket connection */
  ws: import("ws").WebSocket
  /** Workspace IDs this client is subscribed to */
  subscribedWorkspaces: Set<string>
}
