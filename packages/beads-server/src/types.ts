/** Error thrown when a workspace cannot be found or resolved. */
export class WorkspaceNotFoundError extends Error {
  constructor(
    /** The workspace identifier that could not be found */
    public readonly workspace: string,
  ) {
    super(`workspace not found: ${workspace}`)
    this.name = "WorkspaceNotFoundError"
  }
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
