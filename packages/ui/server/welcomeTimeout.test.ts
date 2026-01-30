import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createServer } from "node:http"
import express from "express"
import { WebSocketServer, WebSocket } from "ws"
import type { RalphEvent, RalphStatus } from "./RalphManager.js"

/**
 * Creates a test server that mirrors the production attachWsServer connection handler,
 * including the async IIFE with Promise.race timeout around persister.readEvents()
 * and the outer .catch() fallback welcome message.
 *
 * The mock allows injecting custom persister behavior (slow, throwing, etc.)
 * to test timeout and fallback scenarios.
 */
function createWelcomeTimeoutTestServer(
  port: number,
  options: {
    /** Mock persister.readEvents behavior */
    readEvents: (instanceId: string) => Promise<RalphEvent[]>
    /** In-memory event history (simulates context.eventHistory) */
    eventHistory?: RalphEvent[]
    /** Ralph status to report */
    ralphStatus?: RalphStatus
    /** Whether to simulate an active session */
    hasActiveSession?: boolean
    /** Timeout duration for readEvents (ms) */
    restoreTimeoutMs?: number
    /** If true, getActiveContext() will throw (to test outer .catch fallback) */
    getActiveContextThrows?: boolean
  },
) {
  const app = express()
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })

  const {
    readEvents,
    eventHistory: initialEventHistory = [],
    ralphStatus = "running",
    hasActiveSession = true,
    restoreTimeoutMs = 100, // Use short timeout for tests
    getActiveContextThrows = false,
  } = options

  wss.on("connection", (ws: InstanceType<typeof WebSocket>) => {
    // Mirror the production async IIFE pattern from attachWsServer
    ;(async () => {
      if (getActiveContextThrows) {
        throw new Error("Simulated getActiveContext failure")
      }

      // Simulate: get events from in-memory history
      let events = [...initialEventHistory]
      const status = ralphStatus
      const activeSession = hasActiveSession

      if (activeSession && events.length === 0) {
        // Session is active but no in-memory events - try to restore from disk
        try {
          const persistedEvents = await Promise.race([
            readEvents("default"),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Timed out restoring events from disk")),
                restoreTimeoutMs,
              ),
            ),
          ])
          if (persistedEvents.length > 0) {
            events = persistedEvents
          }
        } catch {
          // Continue with whatever events we have - don't block the welcome message
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
    })().catch(() => {
      // Send a fallback welcome message so the client doesn't stay stuck in 'connecting' state
      try {
        ws.send(
          JSON.stringify({
            type: "connected",
            instanceId: "default",
            timestamp: Date.now(),
            ralphStatus: ralphStatus,
            events: [],
          }),
        )
      } catch {
        // Failed to send fallback - nothing more we can do
      }
    })
  })

  return {
    server,
    wss,
    start: () =>
      new Promise<void>(resolve => {
        server.listen(port, "localhost", () => resolve())
      }),
    close: async () => {
      for (const client of wss.clients) {
        client.terminate()
      }
      wss.close()
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Server close timeout")), 5000)
        server.close(err => {
          clearTimeout(timeout)
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }
}

/**
 * Helper to connect a WebSocket and receive the first message (welcome).
 */
async function connectAndGetWelcome(port: number): Promise<{
  ws: WebSocket
  welcome: {
    type: string
    instanceId: string
    timestamp: number
    ralphStatus: RalphStatus
    events: RalphEvent[]
  }
}> {
  const ws = new WebSocket(`ws://localhost:${port}/ws`)

  const welcome = await new Promise<{
    type: string
    instanceId: string
    timestamp: number
    ralphStatus: RalphStatus
    events: RalphEvent[]
  }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for welcome")), 5000)
    ws.once("message", data => {
      clearTimeout(timeout)
      resolve(JSON.parse(data.toString()))
    })
    ws.once("error", err => {
      clearTimeout(timeout)
      reject(err)
    })
  })

  return { ws, welcome }
}

describe("WebSocket welcome message timeout and fallback", () => {
  const port = 3101 // Different port from other test suites
  let testServer: ReturnType<typeof createWelcomeTimeoutTestServer>

  afterEach(async () => {
    if (testServer) {
      await testServer.close()
    }
  })

  it("sends welcome with persisted events when readEvents resolves quickly", async () => {
    const persistedEvents: RalphEvent[] = [
      { type: "text", timestamp: 1000, content: "Hello" },
      { type: "tool_use", timestamp: 2000, tool: "bash" },
    ]

    testServer = createWelcomeTimeoutTestServer(port, {
      readEvents: async () => persistedEvents,
      eventHistory: [], // Empty in-memory, so it will try to restore from disk
      ralphStatus: "running",
      hasActiveSession: true,
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.instanceId).toBe("default")
      expect(welcome.ralphStatus).toBe("running")
      expect(welcome.events).toHaveLength(2)
      expect(welcome.events[0]).toMatchObject({ type: "text", content: "Hello" })
      expect(welcome.events[1]).toMatchObject({ type: "tool_use", tool: "bash" })
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("sends welcome with empty events when readEvents times out", async () => {
    testServer = createWelcomeTimeoutTestServer(port, {
      // readEvents that never resolves (simulates persister hanging)
      readEvents: () => new Promise<RalphEvent[]>(() => {}),
      eventHistory: [], // Empty in-memory
      ralphStatus: "running",
      hasActiveSession: true,
      restoreTimeoutMs: 50, // Short timeout for fast test
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.instanceId).toBe("default")
      expect(welcome.ralphStatus).toBe("running")
      // When the timeout fires, the catch block swallows the error and
      // we continue with the original empty events array
      expect(welcome.events).toEqual([])
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("sends welcome with in-memory events when readEvents times out and in-memory events exist", async () => {
    const inMemoryEvents: RalphEvent[] = [
      { type: "text", timestamp: 500, content: "Existing event" },
    ]

    testServer = createWelcomeTimeoutTestServer(port, {
      // readEvents that never resolves
      readEvents: () => new Promise<RalphEvent[]>(() => {}),
      eventHistory: inMemoryEvents,
      ralphStatus: "paused",
      hasActiveSession: true,
      restoreTimeoutMs: 50,
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.ralphStatus).toBe("paused")
      // When there are already in-memory events, the code doesn't try to
      // restore from disk at all, so the timeout never applies
      expect(welcome.events).toHaveLength(1)
      expect(welcome.events[0]).toMatchObject({ type: "text", content: "Existing event" })
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("sends welcome with empty events when readEvents throws an error", async () => {
    testServer = createWelcomeTimeoutTestServer(port, {
      readEvents: async () => {
        throw new Error("Database connection failed")
      },
      eventHistory: [],
      ralphStatus: "running",
      hasActiveSession: true,
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.instanceId).toBe("default")
      expect(welcome.ralphStatus).toBe("running")
      // readEvents threw, but the inner catch swallows it and we continue with empty events
      expect(welcome.events).toEqual([])
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("does not attempt disk restore when session is not active", async () => {
    let readEventsCalled = false

    testServer = createWelcomeTimeoutTestServer(port, {
      readEvents: async () => {
        readEventsCalled = true
        return [{ type: "text", timestamp: 1000, content: "Should not appear" }]
      },
      eventHistory: [],
      ralphStatus: "stopped",
      hasActiveSession: false,
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.ralphStatus).toBe("stopped")
      // No disk restore attempted because session is not active
      expect(welcome.events).toEqual([])
      expect(readEventsCalled).toBe(false)
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("sends fallback welcome with empty events when the entire async IIFE throws", async () => {
    testServer = createWelcomeTimeoutTestServer(port, {
      readEvents: async () => [],
      ralphStatus: "running",
      hasActiveSession: true,
      getActiveContextThrows: true, // Simulate the async IIFE throwing
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.instanceId).toBe("default")
      expect(welcome.ralphStatus).toBe("running")
      // The outer .catch sends a fallback with empty events
      expect(welcome.events).toEqual([])
      expect(welcome.timestamp).toBeGreaterThan(0)
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("sends welcome quickly even when readEvents is slow (timeout fires first)", async () => {
    const startTime = Date.now()

    testServer = createWelcomeTimeoutTestServer(port, {
      // readEvents that takes much longer than the timeout
      readEvents: () =>
        new Promise<RalphEvent[]>(resolve =>
          setTimeout(() => resolve([{ type: "text", timestamp: 1000, content: "Late" }]), 10_000),
        ),
      eventHistory: [],
      ralphStatus: "running",
      hasActiveSession: true,
      restoreTimeoutMs: 50, // 50ms timeout
    })
    await testServer.start()

    const { ws, welcome } = await connectAndGetWelcome(port)
    const elapsed = Date.now() - startTime

    try {
      expect(welcome.type).toBe("connected")
      expect(welcome.events).toEqual([])
      // The welcome message should arrive well before the 10s readEvents delay.
      // Allow generous margin for CI environments but ensure it's not waiting
      // for the full 10s readEvents.
      expect(elapsed).toBeLessThan(5000)
    } finally {
      ws.close()
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })
})
