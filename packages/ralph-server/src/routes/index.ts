import type { Express } from "express"
import type { AgentRouteContext } from "./types.js"
import { registerAgentControlRoutes } from "./agentControlRoutes.js"
import { registerInstanceRoutes } from "./instanceRoutes.js"
import { registerTaskChatRoutes } from "./taskChatRoutes.js"

export type { AgentRouteContext } from "./types.js"
export { serializeInstanceState } from "./types.js"
export { registerAgentControlRoutes } from "./agentControlRoutes.js"
export { registerInstanceRoutes } from "./instanceRoutes.js"
export { registerTaskChatRoutes } from "./taskChatRoutes.js"

/**
 * Register all agent-related routes on an Express app.
 * This is a convenience function that registers all route modules at once.
 *
 * Registers:
 * - Agent control routes (POST /api/start|stop|pause|resume, GET /api/status, etc.)
 * - Instance routes (GET/POST /api/instances, /api/ralph/:instanceId/*, etc.)
 * - Task chat routes (POST /api/task-chat/message|clear|cancel, etc.)
 */
export function registerAgentRoutes(app: Express, ctx: AgentRouteContext): void {
  registerAgentControlRoutes(app, ctx)
  registerInstanceRoutes(app, ctx)
  registerTaskChatRoutes(app, ctx)
}
