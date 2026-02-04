/**
 * Server URL configuration for dual-server architecture.
 *
 * The UI can connect to two backend servers:
 * - **beads-server** (default port 4243): Task/label management, workspace info, mutation events
 * - **agent-server** (default port 4244): Agent control, instance management, task chat, agent events
 *
 * In **combined mode** (default): A single server handles everything. The UI connects one
 * WebSocket to `/ws` and all HTTP requests go to the same origin. This is backward compatible.
 *
 * In **split mode**: When `VITE_BEADS_SERVER_URL` is set, the UI creates a second WebSocket
 * to the beads-server for mutation events, and routes beads API calls to that server.
 *
 * Environment variables (set at build time via Vite's `define` or `import.meta.env`):
 * - `VITE_BEADS_SERVER_URL`: Full URL for beads-server (e.g., "http://localhost:4243")
 * - `VITE_AGENT_SERVER_URL`: Full URL for agent-server (e.g., "http://localhost:4244")
 * - `VITE_SPLIT_SERVERS`: Set to "true" to enable split mode with Vite proxy routing
 */

export interface ServerUrls {
  /** Base URL for beads-server HTTP requests (e.g., "http://localhost:4243" or "") */
  beadsHttp: string
  /** Base URL for agent-server HTTP requests (e.g., "http://localhost:4244" or "") */
  agentHttp: string
  /**
   * WebSocket URL for beads-server, or null if running in combined mode.
   * When null, the single agent WebSocket handles all events (including mutations).
   */
  beadsWs: string | null
  /** WebSocket URL for agent-server (e.g., "ws://localhost:4244/ws" or "/ws") */
  agentWs: string
}

/**
 * Whether the UI is configured for split-server mode.
 * In split mode, the beads-server and agent-server run on separate ports.
 */
export function isSplitServerMode(): boolean {
  return !!(
    import.meta.env.VITE_BEADS_SERVER_URL ||
    import.meta.env.VITE_AGENT_SERVER_URL ||
    import.meta.env.VITE_SPLIT_SERVERS === "true"
  )
}

/**
 * Get server URLs based on environment configuration.
 *
 * In combined mode (default): single WebSocket at `/ws`, all HTTP via same origin.
 * In split mode: separate beads WebSocket at `/beads-ws` (or direct URL), HTTP routed by path.
 */
export function getServerUrls(): ServerUrls {
  const beadsServerUrl = import.meta.env.VITE_BEADS_SERVER_URL as string | undefined
  const agentServerUrl = import.meta.env.VITE_AGENT_SERVER_URL as string | undefined

  if (beadsServerUrl || agentServerUrl) {
    // Explicit URLs provided — connect directly to each server
    const beadsBase = (beadsServerUrl || "").replace(/\/$/, "")
    const agentBase = (agentServerUrl || "").replace(/\/$/, "")

    const beadsWsBase = beadsBase.replace(/^http/, "ws")
    const agentWsBase = agentBase.replace(/^http/, "ws")

    return {
      beadsHttp: beadsBase,
      agentHttp: agentBase,
      beadsWs: beadsWsBase ? `${beadsWsBase}/ws` : null,
      agentWs: agentWsBase ? `${agentWsBase}/ws` : buildWsUrl("/ws"),
    }
  }

  if (import.meta.env.VITE_SPLIT_SERVERS === "true") {
    // Split mode via Vite proxy: distinct WebSocket paths
    return {
      beadsHttp: "",
      agentHttp: "",
      beadsWs: buildWsUrl("/beads-ws"),
      agentWs: buildWsUrl("/ws"),
    }
  }

  // Combined mode (default): single server, single WebSocket
  return {
    beadsHttp: "",
    agentHttp: "",
    beadsWs: null, // No separate beads WebSocket needed
    agentWs: buildWsUrl("/ws"),
  }
}

/** Build a WebSocket URL from a path, using the current page's host. */
function buildWsUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}${path}`
}

/**
 * Check whether the given API path should be routed to the beads-server.
 * Used to determine which base URL to prepend to fetch requests.
 */
export function isBeadsApiPath(path: string): boolean {
  return (
    path.startsWith("/api/tasks") ||
    path.startsWith("/api/labels") ||
    path.startsWith("/api/workspace")
  )
}

/**
 * Check whether the given API path should be routed to the agent-server.
 */
export function isAgentApiPath(path: string): boolean {
  return (
    path.startsWith("/api/ralph") ||
    path.startsWith("/api/task-chat") ||
    path.startsWith("/api/instances") ||
    path.startsWith("/api/start") ||
    path.startsWith("/api/stop") ||
    path.startsWith("/api/pause") ||
    path.startsWith("/api/resume") ||
    path.startsWith("/api/status") ||
    path.startsWith("/api/message") ||
    path.startsWith("/api/stop-after-current") ||
    path.startsWith("/api/cancel-stop-after-current") ||
    path.startsWith("/api/state/export")
  )
}

/**
 * Build a full URL for an API request, routing to the correct server.
 */
export function buildServerUrl(path: string): string {
  const urls = getServerUrls()
  if (isBeadsApiPath(path)) {
    return `${urls.beadsHttp}${path}`
  }
  // Default to agent-server for all other API paths
  return `${urls.agentHttp}${path}`
}
