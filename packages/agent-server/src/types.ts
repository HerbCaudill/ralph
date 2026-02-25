/** Configuration for the agent server. */
export interface AgentServerConfig {
  /** Hostname to listen on (default: "localhost"). */
  host: string
  /** Port to listen on (default: 4244). */
  port: number
  /** Directory to store session JSONL files (default: ~/.local/share/ralph/agent-sessions on Linux/macOS, %LOCALAPPDATA%\ralph\agent-sessions on Windows). */
  storageDir?: string
  /** Default working directory for agents. */
  cwd?: string
  /** Optional callback to register additional routes on the Express app. Called after standard routes. */
  customRoutes?: (app: import("express").Express) => void
  /** Optional callback for each new WebSocket connection. Returns per-connection message handler and cleanup. */
  customWsHandler?: (
    ws: import("ws").WebSocket,
    client: import("./wsHandler.js").WsClient,
  ) => import("./wsHandler.js").WsConnectionHandlers | void
}
