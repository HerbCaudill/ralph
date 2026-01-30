/**
 * Backward compatibility layer for legacy task-chat:* wire message types.
 *
 * During the migration from divergent wire formats (ralph:event, task-chat:event,
 * task-chat:message, etc.) to the unified agent:event envelope, this module
 * provides translation functions that convert legacy messages into the new
 * unified format.
 *
 * @deprecated This module exists solely for the transition period. Once all
 * clients and servers have migrated to the unified agent:event envelope,
 * this module and all legacy wire handlers should be removed.
 * Tracked in: r-tufi7.51.5
 */

import type { AgentEvent, AgentEventEnvelope, AgentEventSource } from "./types.js"

// ---------------------------------------------------------------------------
// Legacy wire message type constants
// ---------------------------------------------------------------------------

/** All legacy wire message types that can be translated to agent:event. */
export const LEGACY_WIRE_TYPES = [
  "ralph:event",
  "task-chat:event",
  "task-chat:message",
  "task-chat:chunk",
  "task-chat:status",
  "task-chat:error",
  "task-chat:tool_use",
  "task-chat:tool_update",
  "task-chat:tool_result",
] as const

export type LegacyWireType = (typeof LEGACY_WIRE_TYPES)[number]

/** Legacy reconnect message types that can be translated to agent:reconnect. */
export const LEGACY_RECONNECT_TYPES = ["reconnect", "task-chat:reconnect"] as const

export type LegacyReconnectType = (typeof LEGACY_RECONNECT_TYPES)[number]

/** Legacy pending events response types. */
export const LEGACY_PENDING_TYPES = ["pending_events", "task-chat:pending_events"] as const

export type LegacyPendingType = (typeof LEGACY_PENDING_TYPES)[number]

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Check if a wire message type is a legacy type that can be translated. */
export function isLegacyWireType(type: string): type is LegacyWireType {
  return (LEGACY_WIRE_TYPES as readonly string[]).includes(type)
}

/** Check if a wire message type is a legacy reconnect type. */
export function isLegacyReconnectType(type: string): type is LegacyReconnectType {
  return (LEGACY_RECONNECT_TYPES as readonly string[]).includes(type)
}

/** Check if a wire message type is a legacy pending events response type. */
export function isLegacyPendingType(type: string): type is LegacyPendingType {
  return (LEGACY_PENDING_TYPES as readonly string[]).includes(type)
}

// ---------------------------------------------------------------------------
// Translation functions
// ---------------------------------------------------------------------------

/**
 * Translate a legacy wire message into a unified AgentEventEnvelope.
 *
 * Returns `null` if the message cannot be translated (e.g. it's not a legacy
 * type, or it's a non-event message like task-chat:status/cleared that doesn't
 * carry an agent event payload).
 *
 * Legacy messages that are **translatable** to agent:event envelopes:
 * - `ralph:event` → source: "ralph", event from payload.event
 * - `task-chat:event` → source: "task-chat", event from payload.event
 * - `task-chat:message` → source: "task-chat", synthesized message event
 * - `task-chat:chunk` → source: "task-chat", synthesized partial message event
 * - `task-chat:tool_use` → source: "task-chat", synthesized tool_use event
 * - `task-chat:tool_update` → source: "task-chat", synthesized tool_use event (update)
 * - `task-chat:tool_result` → source: "task-chat", synthesized tool_result event
 * - `task-chat:error` → source: "task-chat", synthesized error event
 * - `task-chat:status` → source: "task-chat", synthesized status event
 */
export function translateLegacyToEnvelope(
  message: Record<string, unknown>,
): AgentEventEnvelope | null {
  const type = message.type as string | undefined
  if (!type || !isLegacyWireType(type)) return null

  const instanceId = (message.instanceId as string) || "default"
  const workspaceId = (message.workspaceId as string | null) ?? null
  const timestamp = (message.timestamp as number) || Date.now()

  switch (type) {
    case "ralph:event": {
      const event = message.event as AgentEvent | undefined
      if (!event) return null
      return {
        type: "agent:event",
        source: "ralph",
        instanceId,
        workspaceId,
        event,
        timestamp,
        ...(typeof message.eventIndex === "number" ? { eventIndex: message.eventIndex } : {}),
      }
    }

    case "task-chat:event": {
      const event = message.event as AgentEvent | undefined
      if (!event) return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event,
        timestamp,
      }
    }

    case "task-chat:message": {
      const msg = message.message as { content?: string; role?: string; id?: string } | undefined
      if (!msg) return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "message",
          content: msg.content ?? "",
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:chunk": {
      const text = message.text as string | undefined
      if (typeof text !== "string") return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "message",
          content: text,
          isPartial: true,
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:status": {
      const status = message.status as string | undefined
      if (typeof status !== "string") return null
      // Map task-chat status strings to AgentStatus
      const agentStatus = mapTaskChatStatus(status)
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "status",
          status: agentStatus,
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:error": {
      const error = message.error as string | undefined
      if (typeof error !== "string") return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "error",
          message: error,
          fatal: false,
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:tool_use": {
      const toolUse = message.toolUse as { id?: string; tool?: string; input?: unknown } | undefined
      if (!toolUse) return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "tool_use",
          toolUseId: toolUse.id ?? `legacy-${timestamp}`,
          tool: toolUse.tool ?? "unknown",
          input: (toolUse.input as Record<string, unknown>) ?? {},
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:tool_update": {
      // tool_update maps to tool_use (it's an in-progress update)
      const toolUse = message.toolUse as { id?: string; tool?: string; input?: unknown } | undefined
      if (!toolUse) return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "tool_use",
          toolUseId: toolUse.id ?? `legacy-${timestamp}`,
          tool: toolUse.tool ?? "unknown",
          input: (toolUse.input as Record<string, unknown>) ?? {},
          timestamp,
        },
        timestamp,
      }
    }

    case "task-chat:tool_result": {
      const toolUse = message.toolUse as {
        id?: string
        output?: string
        error?: string
        isError?: boolean
      } | undefined
      if (!toolUse) return null
      return {
        type: "agent:event",
        source: "task-chat",
        instanceId,
        workspaceId,
        event: {
          type: "tool_result",
          toolUseId: toolUse.id ?? `legacy-${timestamp}`,
          output: toolUse.output,
          error: toolUse.error,
          isError: toolUse.isError ?? false,
          timestamp,
        },
        timestamp,
      }
    }

    default:
      return null
  }
}

/**
 * Translate a legacy reconnect message into a unified agent:reconnect request.
 *
 * @returns The translated reconnect request, or null if not translatable.
 */
export function translateLegacyReconnect(
  message: Record<string, unknown>,
): { type: "agent:reconnect"; source: AgentEventSource; instanceId: string; lastEventTimestamp?: number } | null {
  const type = message.type as string | undefined
  if (!type) return null

  switch (type) {
    case "reconnect":
      return {
        type: "agent:reconnect",
        source: "ralph",
        instanceId: (message.instanceId as string) || "default",
        ...(typeof message.lastEventTimestamp === "number"
          ? { lastEventTimestamp: message.lastEventTimestamp }
          : {}),
      }

    case "task-chat:reconnect":
      return {
        type: "agent:reconnect",
        source: "task-chat",
        instanceId: (message.instanceId as string) || "default",
        ...(typeof message.lastEventTimestamp === "number"
          ? { lastEventTimestamp: message.lastEventTimestamp }
          : {}),
      }

    default:
      return null
  }
}

/**
 * Convert a unified AgentEventEnvelope back to its legacy wire format.
 *
 * Used by the server to maintain backward compatibility with old clients
 * by broadcasting events in both new and legacy formats simultaneously.
 *
 * @returns The legacy wire message, or null if no legacy equivalent exists.
 */
export function envelopeToLegacy(
  envelope: AgentEventEnvelope,
): Record<string, unknown> | null {
  const { source, instanceId, workspaceId, event, timestamp, eventIndex } = envelope

  if (source === "ralph") {
    return {
      type: "ralph:event",
      instanceId,
      workspaceId,
      event,
      timestamp,
      ...(typeof eventIndex === "number" ? { eventIndex } : {}),
    }
  }

  if (source === "task-chat") {
    return {
      type: "task-chat:event",
      instanceId,
      workspaceId,
      event,
      timestamp,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map legacy TaskChat status strings to unified AgentStatus values.
 *
 * Legacy statuses: "idle", "processing", "streaming", "error"
 * Unified statuses: "idle", "starting", "running", "paused", "stopping", "stopped"
 */
function mapTaskChatStatus(
  legacyStatus: string,
): "idle" | "starting" | "running" | "paused" | "stopping" | "stopped" {
  switch (legacyStatus) {
    case "idle":
      return "idle"
    case "processing":
    case "streaming":
      return "running"
    case "error":
      return "stopped"
    default:
      return "idle"
  }
}
