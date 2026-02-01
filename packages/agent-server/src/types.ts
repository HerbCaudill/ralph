import type { WebSocket } from "ws"

/** Configuration for the agent server. */
export interface AgentServerConfig {
  /** Hostname to listen on (default: "localhost") */
  host: string
  /** Port to listen on (default: 4244) */
  port: number
  /** Workspace directory. Defaults to process.cwd() if not set. */
  workspacePath?: string
}

/** WebSocket client with session subscription tracking. */
export interface WsClient {
  /** The WebSocket connection */
  ws: WebSocket
  /** Session IDs this client is subscribed to */
  subscribedSessions: Set<string>
}
