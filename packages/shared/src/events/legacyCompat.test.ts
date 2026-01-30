import { describe, it, expect } from "vitest"
import {
  isLegacyWireType,
  isLegacyReconnectType,
  isLegacyPendingType,
  translateLegacyToEnvelope,
  translateLegacyReconnect,
  envelopeToLegacy,
  LEGACY_WIRE_TYPES,
  LEGACY_RECONNECT_TYPES,
  LEGACY_PENDING_TYPES,
} from "./legacyCompat.js"
import type { AgentEventEnvelope } from "./types.js"

describe("Legacy Compatibility Layer", () => {
  const timestamp = 1706123456789

  // -----------------------------------------------------------------------
  // Type guards
  // -----------------------------------------------------------------------

  describe("isLegacyWireType", () => {
    it("returns true for all legacy wire types", () => {
      for (const type of LEGACY_WIRE_TYPES) {
        expect(isLegacyWireType(type)).toBe(true)
      }
    })

    it("returns false for unified types", () => {
      expect(isLegacyWireType("agent:event")).toBe(false)
      expect(isLegacyWireType("agent:reconnect")).toBe(false)
      expect(isLegacyWireType("agent:pending_events")).toBe(false)
    })

    it("returns false for non-event types", () => {
      expect(isLegacyWireType("connected")).toBe(false)
      expect(isLegacyWireType("task-chat:cleared")).toBe(false)
      expect(isLegacyWireType("mutation:event")).toBe(false)
    })
  })

  describe("isLegacyReconnectType", () => {
    it("returns true for legacy reconnect types", () => {
      for (const type of LEGACY_RECONNECT_TYPES) {
        expect(isLegacyReconnectType(type)).toBe(true)
      }
    })

    it("returns false for unified reconnect type", () => {
      expect(isLegacyReconnectType("agent:reconnect")).toBe(false)
    })
  })

  describe("isLegacyPendingType", () => {
    it("returns true for legacy pending types", () => {
      for (const type of LEGACY_PENDING_TYPES) {
        expect(isLegacyPendingType(type)).toBe(true)
      }
    })

    it("returns false for unified pending type", () => {
      expect(isLegacyPendingType("agent:pending_events")).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // translateLegacyToEnvelope
  // -----------------------------------------------------------------------

  describe("translateLegacyToEnvelope", () => {
    describe("ralph:event", () => {
      it("translates a legacy ralph:event to agent:event envelope", () => {
        const legacy = {
          type: "ralph:event",
          instanceId: "instance-1",
          workspaceId: "ws-1",
          event: { type: "tool_use", timestamp, tool: "bash", input: "ls" },
          eventIndex: 42,
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "ralph",
          instanceId: "instance-1",
          workspaceId: "ws-1",
          event: { type: "tool_use", timestamp, tool: "bash", input: "ls" },
          timestamp,
          eventIndex: 42,
        })
      })

      it("returns null when event payload is missing", () => {
        const legacy = {
          type: "ralph:event",
          instanceId: "instance-1",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })

      it("defaults instanceId to 'default' when missing", () => {
        const legacy = {
          type: "ralph:event",
          event: { type: "message", timestamp, content: "hello" },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.instanceId).toBe("default")
      })

      it("defaults workspaceId to null when missing", () => {
        const legacy = {
          type: "ralph:event",
          event: { type: "message", timestamp, content: "hello" },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.workspaceId).toBeNull()
      })
    })

    describe("task-chat:event", () => {
      it("translates a legacy task-chat:event to agent:event envelope", () => {
        const legacy = {
          type: "task-chat:event",
          instanceId: "instance-2",
          workspaceId: null,
          event: { type: "message", timestamp, content: "Task response" },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-2",
          workspaceId: null,
          event: { type: "message", timestamp, content: "Task response" },
          timestamp,
        })
      })

      it("returns null when event payload is missing", () => {
        const legacy = {
          type: "task-chat:event",
          instanceId: "instance-2",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })
    })

    describe("task-chat:message", () => {
      it("translates to a message event", () => {
        const legacy = {
          type: "task-chat:message",
          instanceId: "instance-3",
          workspaceId: null,
          message: { content: "Hello from task chat", role: "assistant", id: "msg-1" },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-3",
          workspaceId: null,
          event: {
            type: "message",
            content: "Hello from task chat",
            timestamp,
          },
          timestamp,
        })
      })

      it("returns null when message payload is missing", () => {
        const legacy = {
          type: "task-chat:message",
          instanceId: "instance-3",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })

      it("defaults content to empty string when missing", () => {
        const legacy = {
          type: "task-chat:message",
          message: { role: "assistant" },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "message", content: "" })
      })
    })

    describe("task-chat:chunk", () => {
      it("translates to a partial message event", () => {
        const legacy = {
          type: "task-chat:chunk",
          instanceId: "instance-4",
          workspaceId: null,
          text: "streaming text...",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-4",
          workspaceId: null,
          event: {
            type: "message",
            content: "streaming text...",
            isPartial: true,
            timestamp,
          },
          timestamp,
        })
      })

      it("returns null when text is missing", () => {
        const legacy = {
          type: "task-chat:chunk",
          instanceId: "instance-4",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })
    })

    describe("task-chat:status", () => {
      it("translates 'idle' to idle status", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          status: "idle",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "status", status: "idle" })
      })

      it("translates 'processing' to running status", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          status: "processing",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "status", status: "running" })
      })

      it("translates 'streaming' to running status", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          status: "streaming",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "status", status: "running" })
      })

      it("translates 'error' to stopped status", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          status: "error",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "status", status: "stopped" })
      })

      it("defaults unknown status to idle", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          status: "unknown-status",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({ type: "status", status: "idle" })
      })

      it("returns null when status is missing", () => {
        const legacy = {
          type: "task-chat:status",
          instanceId: "instance-5",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })
    })

    describe("task-chat:error", () => {
      it("translates to a non-fatal error event", () => {
        const legacy = {
          type: "task-chat:error",
          instanceId: "instance-6",
          workspaceId: null,
          error: "Something went wrong",
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-6",
          workspaceId: null,
          event: {
            type: "error",
            message: "Something went wrong",
            fatal: false,
            timestamp,
          },
          timestamp,
        })
      })

      it("returns null when error string is missing", () => {
        const legacy = {
          type: "task-chat:error",
          instanceId: "instance-6",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })
    })

    describe("task-chat:tool_use", () => {
      it("translates to a tool_use event", () => {
        const legacy = {
          type: "task-chat:tool_use",
          instanceId: "instance-7",
          workspaceId: null,
          toolUse: { id: "tool-1", tool: "Bash", input: { command: "ls" } },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-7",
          workspaceId: null,
          event: {
            type: "tool_use",
            toolUseId: "tool-1",
            tool: "Bash",
            input: { command: "ls" },
            timestamp,
          },
          timestamp,
        })
      })

      it("returns null when toolUse is missing", () => {
        const legacy = {
          type: "task-chat:tool_use",
          instanceId: "instance-7",
          timestamp,
        }

        expect(translateLegacyToEnvelope(legacy)).toBeNull()
      })

      it("defaults toolUseId and tool when missing from payload", () => {
        const legacy = {
          type: "task-chat:tool_use",
          toolUse: {},
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({
          type: "tool_use",
          tool: "unknown",
        })
        expect((result?.event as { toolUseId: string }).toolUseId).toMatch(/^legacy-/)
      })
    })

    describe("task-chat:tool_update", () => {
      it("translates to a tool_use event (in-progress update)", () => {
        const legacy = {
          type: "task-chat:tool_update",
          instanceId: "instance-8",
          workspaceId: null,
          toolUse: { id: "tool-2", tool: "Read", input: { path: "/file.ts" } },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result?.event).toMatchObject({
          type: "tool_use",
          toolUseId: "tool-2",
          tool: "Read",
          input: { path: "/file.ts" },
        })
      })
    })

    describe("task-chat:tool_result", () => {
      it("translates to a tool_result event", () => {
        const legacy = {
          type: "task-chat:tool_result",
          instanceId: "instance-9",
          workspaceId: null,
          toolUse: { id: "tool-3", output: "file contents", isError: false },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)

        expect(result).toEqual({
          type: "agent:event",
          source: "task-chat",
          instanceId: "instance-9",
          workspaceId: null,
          event: {
            type: "tool_result",
            toolUseId: "tool-3",
            output: "file contents",
            isError: false,
            timestamp,
          },
          timestamp,
        })
      })

      it("handles error results", () => {
        const legacy = {
          type: "task-chat:tool_result",
          instanceId: "instance-9",
          toolUse: { id: "tool-4", error: "Not found", isError: true },
          timestamp,
        }

        const result = translateLegacyToEnvelope(legacy)
        expect(result?.event).toMatchObject({
          type: "tool_result",
          toolUseId: "tool-4",
          error: "Not found",
          isError: true,
        })
      })
    })

    describe("non-translatable messages", () => {
      it("returns null for agent:event (already unified)", () => {
        expect(
          translateLegacyToEnvelope({
            type: "agent:event",
            source: "ralph",
            instanceId: "i",
            event: {},
            timestamp,
          }),
        ).toBeNull()
      })

      it("returns null for messages without a type", () => {
        expect(translateLegacyToEnvelope({ data: "hello" })).toBeNull()
      })

      it("returns null for non-event message types", () => {
        expect(translateLegacyToEnvelope({ type: "connected", timestamp })).toBeNull()
        expect(translateLegacyToEnvelope({ type: "task-chat:cleared", timestamp })).toBeNull()
        expect(translateLegacyToEnvelope({ type: "mutation:event", timestamp })).toBeNull()
      })
    })
  })

  // -----------------------------------------------------------------------
  // translateLegacyReconnect
  // -----------------------------------------------------------------------

  describe("translateLegacyReconnect", () => {
    it("translates legacy 'reconnect' to agent:reconnect with source ralph", () => {
      const legacy = {
        type: "reconnect",
        instanceId: "instance-1",
        lastEventTimestamp: 1706123456789,
      }

      const result = translateLegacyReconnect(legacy)

      expect(result).toEqual({
        type: "agent:reconnect",
        source: "ralph",
        instanceId: "instance-1",
        lastEventTimestamp: 1706123456789,
      })
    })

    it("translates legacy 'task-chat:reconnect' to agent:reconnect with source task-chat", () => {
      const legacy = {
        type: "task-chat:reconnect",
        instanceId: "instance-2",
        lastEventTimestamp: 1706123456890,
      }

      const result = translateLegacyReconnect(legacy)

      expect(result).toEqual({
        type: "agent:reconnect",
        source: "task-chat",
        instanceId: "instance-2",
        lastEventTimestamp: 1706123456890,
      })
    })

    it("defaults instanceId to 'default' when missing", () => {
      const legacy = { type: "reconnect" }

      const result = translateLegacyReconnect(legacy)
      expect(result?.instanceId).toBe("default")
    })

    it("omits lastEventTimestamp when not provided", () => {
      const legacy = { type: "reconnect", instanceId: "instance-1" }

      const result = translateLegacyReconnect(legacy)
      expect(result).not.toHaveProperty("lastEventTimestamp")
    })

    it("returns null for non-reconnect types", () => {
      expect(translateLegacyReconnect({ type: "agent:reconnect" })).toBeNull()
      expect(translateLegacyReconnect({ type: "ping" })).toBeNull()
      expect(translateLegacyReconnect({})).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // envelopeToLegacy
  // -----------------------------------------------------------------------

  describe("envelopeToLegacy", () => {
    it("converts ralph-sourced envelope to legacy ralph:event", () => {
      const envelope: AgentEventEnvelope = {
        type: "agent:event",
        source: "ralph",
        instanceId: "instance-1",
        workspaceId: "ws-1",
        event: { type: "message", content: "hello", timestamp },
        timestamp,
        eventIndex: 5,
      }

      const result = envelopeToLegacy(envelope)

      expect(result).toEqual({
        type: "ralph:event",
        instanceId: "instance-1",
        workspaceId: "ws-1",
        event: { type: "message", content: "hello", timestamp },
        timestamp,
        eventIndex: 5,
      })
    })

    it("converts task-chat-sourced envelope to legacy task-chat:event", () => {
      const envelope: AgentEventEnvelope = {
        type: "agent:event",
        source: "task-chat",
        instanceId: "instance-2",
        workspaceId: null,
        event: { type: "tool_use", toolUseId: "t1", tool: "Bash", input: {}, timestamp },
        timestamp,
      }

      const result = envelopeToLegacy(envelope)

      expect(result).toEqual({
        type: "task-chat:event",
        instanceId: "instance-2",
        workspaceId: null,
        event: { type: "tool_use", toolUseId: "t1", tool: "Bash", input: {}, timestamp },
        timestamp,
      })
    })

    it("omits eventIndex when not present in envelope", () => {
      const envelope: AgentEventEnvelope = {
        type: "agent:event",
        source: "ralph",
        instanceId: "instance-1",
        workspaceId: null,
        event: { type: "message", content: "test", timestamp },
        timestamp,
      }

      const result = envelopeToLegacy(envelope)
      expect(result).not.toHaveProperty("eventIndex")
    })

    it("returns null for unknown source", () => {
      const envelope = {
        type: "agent:event" as const,
        source: "unknown" as "ralph",
        instanceId: "instance-1",
        workspaceId: null,
        event: { type: "message" as const, content: "test", timestamp },
        timestamp,
      }

      // Force unknown source
      const result = envelopeToLegacy({ ...envelope, source: "future-source" as "ralph" })
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Round-trip tests
  // -----------------------------------------------------------------------

  describe("round-trip: legacy → envelope → legacy", () => {
    it("ralph:event round-trips correctly", () => {
      const original = {
        type: "ralph:event" as const,
        instanceId: "instance-1",
        workspaceId: "ws-1",
        event: { type: "tool_use", timestamp, tool: "bash", input: "ls" },
        eventIndex: 10,
        timestamp,
      }

      const envelope = translateLegacyToEnvelope(original)
      expect(envelope).not.toBeNull()

      const legacy = envelopeToLegacy(envelope!)

      expect(legacy).toEqual({
        type: "ralph:event",
        instanceId: "instance-1",
        workspaceId: "ws-1",
        event: original.event,
        eventIndex: 10,
        timestamp,
      })
    })

    it("task-chat:event round-trips correctly", () => {
      const original = {
        type: "task-chat:event" as const,
        instanceId: "instance-2",
        workspaceId: null,
        event: { type: "message", timestamp, content: "Hello" },
        timestamp,
      }

      const envelope = translateLegacyToEnvelope(original)
      expect(envelope).not.toBeNull()

      const legacy = envelopeToLegacy(envelope!)

      expect(legacy).toEqual({
        type: "task-chat:event",
        instanceId: "instance-2",
        workspaceId: null,
        event: original.event,
        timestamp,
      })
    })
  })
})
