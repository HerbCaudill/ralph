import type { WebSocket, RawData } from "ws"
import type { RalphEvent } from "./RalphManager.js"
import type { RalphRegistry, RalphInstanceState } from "./RalphRegistry.js"
import type { TaskChatEvent } from "./TaskChatManager.js"
import type { TaskChatEventPersister } from "./TaskChatEventPersister.js"
import type {
  AgentEventEnvelope,
  AgentEventSource,
  AgentPendingEventsResponse,
} from "@herbcaudill/ralph-shared"
import { envelopeToLegacy } from "@herbcaudill/ralph-shared"
import { serializeInstanceState } from "./routes/types.js"

/**
 * Options for creating an AgentWsHandler.
 */
export interface AgentWsHandlerOptions {
  /** Get the RalphRegistry */
  getRalphRegistry: () => RalphRegistry
  /** Get event history for the active context */
  getEventHistory: () => unknown[]
  /** Set event history for the active context */
  setEventHistory: (events: unknown[]) => void
  /** Get the RalphManager status for the active context */
  getRalphManagerStatus: () => string
  /** Get the TaskChatManager status */
  getTaskChatStatus: () => string
  /** Get the TaskChatEventPersister */
  getTaskChatEventPersister: () => TaskChatEventPersister
  /** Broadcast to all clients in a workspace */
  broadcastToWorkspace: (workspaceId: string | null, message: unknown) => void
}

/**
 * Client entry in the connected clients set.
 */
export interface AgentWsClient {
  ws: WebSocket
  isAlive: boolean
  /** Workspace IDs this client is subscribed to. Empty set = receive all. */
  workspaceIds: Set<string>
}

/**
 * Handle WebSocket messages related to agent functionality.
 *
 * This module processes:
 * - chat_message: Forward user message to Ralph instance
 * - agent:reconnect: Unified reconnection handler for ralph and task-chat
 * - reconnect: Legacy Ralph reconnect (deprecated)
 * - task-chat:reconnect: Legacy task-chat reconnect (deprecated)
 *
 * Also provides functions for:
 * - Sending welcome messages with current state
 * - Wiring registry events to WebSocket broadcasts
 */
export function handleAgentWsMessage(
  ws: WebSocket,
  data: RawData,
  client: AgentWsClient,
  options: AgentWsHandlerOptions,
): void {
  try {
    const message = JSON.parse(data.toString())

    switch (message.type) {
      case "chat_message": {
        const chatMessage = message.message as string | undefined
        const instanceId = (message.instanceId as string) || "default"
        if (!chatMessage) {
          ws.send(
            JSON.stringify({ type: "error", error: "Message is required", timestamp: Date.now() }),
          )
          return
        }

        const registry = options.getRalphRegistry()
        const instance = registry.get(instanceId)

        if (!instance) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: `Ralph instance '${instanceId}' not found. Click Start to begin.`,
              timestamp: Date.now(),
            }),
          )
          return
        }

        if (!instance.manager.canAcceptMessages) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Ralph is not running. Click Start to begin.",
              timestamp: Date.now(),
            }),
          )
          return
        }

        instance.manager.send({ type: "message", text: chatMessage })

        options.broadcastToWorkspace(instance.workspaceId, {
          type: "user_message",
          message: chatMessage,
          instanceId,
          timestamp: Date.now(),
        })
        break
      }

      case "agent:reconnect": {
        const arSource = message.source as AgentEventSource | undefined
        const arInstanceId = (message.instanceId as string) || "default"
        const arLastTs = message.lastEventTimestamp as number | undefined

        if (arSource === "ralph") {
          const registry = options.getRalphRegistry()
          const eventHistory = registry.getEventHistory(arInstanceId)

          let pendingEvents: RalphEvent[] = []
          if (typeof arLastTs === "number" && arLastTs > 0) {
            pendingEvents = eventHistory.filter(event => event.timestamp >= arLastTs)
          } else {
            pendingEvents = eventHistory
          }

          const instance = registry.get(arInstanceId)
          const ralphStatus = instance?.manager.status ?? "stopped"

          const response: AgentPendingEventsResponse = {
            type: "agent:pending_events",
            source: "ralph",
            instanceId: arInstanceId,
            events: pendingEvents,
            totalEvents: eventHistory.length,
            status: ralphStatus,
            timestamp: Date.now(),
          }
          ws.send(JSON.stringify(response))
        } else if (arSource === "task-chat") {
          ;(async () => {
            try {
              const persister = options.getTaskChatEventPersister()

              let pendingEvents: TaskChatEvent[]
              if (typeof arLastTs === "number" && arLastTs > 0) {
                pendingEvents = await persister.readEventsSince(arInstanceId, arLastTs)
              } else {
                pendingEvents = await persister.readEvents(arInstanceId)
              }

              const totalEvents = await persister.getEventCount(arInstanceId)
              const taskChatStatus = options.getTaskChatStatus()

              const response: AgentPendingEventsResponse = {
                type: "agent:pending_events",
                source: "task-chat",
                instanceId: arInstanceId,
                events: pendingEvents,
                totalEvents,
                status: taskChatStatus,
                timestamp: Date.now(),
              }
              ws.send(JSON.stringify(response))
            } catch (err) {
              console.error("[ws] agent:reconnect (task-chat) failed:", err)
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: `Failed to sync task chat events: ${err instanceof Error ? err.message : "Unknown error"}`,
                  timestamp: Date.now(),
                }),
              )
            }
          })()
        }
        break
      }

      // Legacy reconnect handler — kept for backward compatibility
      case "reconnect": {
        const instanceId = (message.instanceId as string) || "default"
        const lastEventTimestamp = message.lastEventTimestamp as number | undefined

        const registry = options.getRalphRegistry()
        const eventHistory = registry.getEventHistory(instanceId)

        let pendingEvents: RalphEvent[] = []
        if (typeof lastEventTimestamp === "number" && lastEventTimestamp > 0) {
          pendingEvents = eventHistory.filter(event => event.timestamp >= lastEventTimestamp)
        } else {
          pendingEvents = eventHistory
        }

        const instance = registry.get(instanceId)
        const status = instance?.manager.status ?? "stopped"

        ws.send(
          JSON.stringify({
            type: "pending_events",
            instanceId,
            events: pendingEvents,
            totalEvents: eventHistory.length,
            ralphStatus: status,
            timestamp: Date.now(),
          }),
        )
        break
      }

      // Legacy task-chat:reconnect handler — kept for backward compatibility
      case "task-chat:reconnect": {
        const tcInstanceId = (message.instanceId as string) || "default"
        const tcLastEventTimestamp = message.lastEventTimestamp as number | undefined

        ;(async () => {
          try {
            const persister = options.getTaskChatEventPersister()

            let pendingEvents: TaskChatEvent[]
            if (typeof tcLastEventTimestamp === "number" && tcLastEventTimestamp > 0) {
              pendingEvents = await persister.readEventsSince(tcInstanceId, tcLastEventTimestamp)
            } else {
              pendingEvents = await persister.readEvents(tcInstanceId)
            }

            const totalEvents = await persister.getEventCount(tcInstanceId)
            const taskChatStatus = options.getTaskChatStatus()

            ws.send(
              JSON.stringify({
                type: "task-chat:pending_events",
                instanceId: tcInstanceId,
                events: pendingEvents,
                totalEvents,
                status: taskChatStatus,
                timestamp: Date.now(),
              }),
            )
          } catch (err) {
            console.error("[ws] task-chat:reconnect failed:", err)
            ws.send(
              JSON.stringify({
                type: "task-chat:error",
                error: `Failed to sync task chat events: ${err instanceof Error ? err.message : "Unknown error"}`,
                timestamp: Date.now(),
              }),
            )
          }
        })()
        break
      }

      // Not an agent message - return false to let other handlers process it
      default:
        return
    }
  } catch (err) {
    console.error("[ws] failed to parse agent message:", err)
  }
}

/**
 * Send the welcome message to a newly connected WebSocket client.
 * Includes current Ralph status and event history (restoring from disk if needed).
 */
export async function sendWelcomeMessage(
  ws: WebSocket,
  options: AgentWsHandlerOptions,
): Promise<void> {
  const registry = options.getRalphRegistry()
  const persister = registry.getSessionEventPersister()

  let events = options.getEventHistory() as RalphEvent[]
  const status = options.getRalphManagerStatus()
  const hasActiveSession = status === "running" || status === "paused" || status === "pausing"

  if (hasActiveSession && persister && events.length === 0) {
    try {
      const RESTORE_TIMEOUT_MS = 5_000
      const persistedEvents = await Promise.race([
        persister.readEvents("default"),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Timed out restoring events from disk")),
            RESTORE_TIMEOUT_MS,
          ),
        ),
      ])
      if (persistedEvents.length > 0) {
        events = persistedEvents
        options.setEventHistory(persistedEvents)
      }
    } catch (err) {
      console.warn("[ws] Failed to restore events from disk:", err)
    }
  }

  ws.send(
    JSON.stringify({
      type: "connected",
      instanceId: "default",
      timestamp: Date.now(),
      ralphStatus: status,
      events,
    }),
  )

  // Send full instance list
  const allInstances = registry.getAll().map(serializeInstanceState)
  ws.send(
    JSON.stringify({
      type: "instances:list",
      timestamp: Date.now(),
      instances: allInstances,
    }),
  )
}
