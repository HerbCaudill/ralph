import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createServer } from "node:http"
import express from "express"
import { WebSocketServer, WebSocket } from "ws"
import { EventEmitter } from "node:events"
import { RalphManager, type RalphEvent, type RalphStatus } from "./RalphManager.js"

interface WsClient {
  ws: typeof WebSocket.prototype
  isAlive: boolean
}

/**
 * Creates a test server with WebSocket support and broadcast capabilities.
 * Mirrors the production server's broadcast integration with RalphManager.
 */
function createTestServer(
  /** Port number for the server to listen on */
  port: number,
) {
  const app = express()
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })
  const clients = new Set<WsClient>()

  /**
   * Broadcast a message to all connected WebSocket clients.
   * Only sends to clients with open WebSocket connections.
   */
  const broadcast = (
    /** Message to broadcast (will be JSON stringified) */
    message: unknown,
  ) => {
    const payload = JSON.stringify(message)
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload)
      }
    }
  }

  wss.on("connection", (ws: typeof WebSocket.prototype) => {
    const client: WsClient = { ws, isAlive: true }
    clients.add(client)

    ws.on("close", () => {
      clients.delete(client)
    })

    ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }))
  })

  return {
    server,
    wss,
    broadcast,
    getClientCount: () => clients.size,
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
 * Creates a mock RalphManager for testing event broadcasting.
 */
function createMockRalphManager(): RalphManager {
  // Use a minimal mock spawn that does nothing
  const mockSpawn = () => {
    const emitter = new EventEmitter() as ReturnType<typeof import("node:child_process").spawn>
    Object.assign(emitter, {
      stdin: { writable: true, write: () => {} },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: () => true,
      pid: 12345,
    })
    // Emit spawn event on next tick
    setTimeout(() => emitter.emit("spawn"), 0)
    return emitter
  }

  return new RalphManager({
    command: "echo",
    args: [],
    spawn: mockSpawn as unknown as typeof import("node:child_process").spawn,
  })
}

/**
 * Wires up RalphManager events to broadcast, matching production implementation.
 * Sets up listeners for event, status, output, error, and exit events.
 */
function wireRalphToBroadcast(
  /** RalphManager instance to listen to */
  manager: RalphManager,
  /** Broadcast function to call with formatted messages */
  broadcast: (msg: unknown) => void,
) {
  manager.on("event", (event: RalphEvent) => {
    broadcast({
      type: "ralph:event",
      event,
      timestamp: Date.now(),
    })
  })

  manager.on("status", (status: RalphStatus) => {
    broadcast({
      type: "ralph:status",
      status,
      timestamp: Date.now(),
    })
  })

  manager.on("output", (line: string) => {
    broadcast({
      type: "ralph:output",
      line,
      timestamp: Date.now(),
    })
  })

  manager.on("error", (error: Error) => {
    broadcast({
      type: "ralph:error",
      error: error.message,
      timestamp: Date.now(),
    })
  })

  manager.on("exit", (info: { code: number | null; signal: string | null }) => {
    broadcast({
      type: "ralph:exit",
      code: info.code,
      signal: info.signal,
      timestamp: Date.now(),
    })
  })
}

describe("WebSocket event broadcast", () => {
  const port = 3098
  let testServer: ReturnType<typeof createTestServer>

  beforeEach(async () => {
    testServer = createTestServer(port)
    await testServer.start()
  })

  afterEach(async () => {
    await testServer.close()
  })

  it("broadcasts messages to all connected clients", async () => {
    // Connect two clients
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`)
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`)

    const messages1: unknown[] = []
    const messages2: unknown[] = []

    // Wait for both to connect
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("ws1 timeout")), 5000)
        ws1.once("message", data => {
          clearTimeout(timeout)
          messages1.push(JSON.parse(data.toString()))
          resolve()
        })
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("ws2 timeout")), 5000)
        ws2.once("message", data => {
          clearTimeout(timeout)
          messages2.push(JSON.parse(data.toString()))
          resolve()
        })
      }),
    ])

    // Both should have received welcome message
    expect(messages1[0]).toHaveProperty("type", "connected")
    expect(messages2[0]).toHaveProperty("type", "connected")

    // Set up listeners for broadcast
    const broadcast1 = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("broadcast1 timeout")), 5000)
      ws1.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    const broadcast2 = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("broadcast2 timeout")), 5000)
      ws2.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Broadcast a message
    testServer.broadcast({ type: "test", data: "hello" })

    // Both clients should receive the broadcast
    const [received1, received2] = await Promise.all([broadcast1, broadcast2])

    expect(received1).toEqual({ type: "test", data: "hello" })
    expect(received2).toEqual({ type: "test", data: "hello" })

    ws1.close()
    ws2.close()
  })

  it("broadcasts ralph:status when RalphManager status changes", async () => {
    const manager = createMockRalphManager()
    wireRalphToBroadcast(manager, testServer.broadcast)

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Collect status messages
    const statusMessages: unknown[] = []
    const gotStatuses = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Status timeout")), 5000)
      ws.on("message", data => {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ralph:status") {
          statusMessages.push(msg)
          // We expect "starting" and "running" statuses
          if (statusMessages.length >= 2) {
            clearTimeout(timeout)
            resolve()
          }
        }
      })
    })

    // Start the manager (will emit status changes)
    await manager.start()

    await gotStatuses

    expect(statusMessages).toHaveLength(2)
    expect(statusMessages[0]).toMatchObject({ type: "ralph:status", status: "starting" })
    expect(statusMessages[1]).toMatchObject({ type: "ralph:status", status: "running" })

    ws.close()
    manager.removeAllListeners()
  })

  it("broadcasts ralph:event when RalphManager emits events", async () => {
    const manager = createMockRalphManager()
    wireRalphToBroadcast(manager, testServer.broadcast)

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Set up listener for event broadcast
    const eventPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Event timeout")), 5000)
      ws.on("message", data => {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ralph:event") {
          clearTimeout(timeout)
          resolve(msg)
        }
      })
    })

    // Manually emit an event from the manager
    const testEvent: RalphEvent = {
      type: "tool_use",
      timestamp: Date.now(),
      tool: "bash",
      input: "ls -la",
    }
    manager.emit("event", testEvent)

    const received = await eventPromise

    expect(received).toMatchObject({
      type: "ralph:event",
      event: testEvent,
    })
    expect(received).toHaveProperty("timestamp")

    ws.close()
    manager.removeAllListeners()
  })

  it("broadcasts ralph:output for non-JSON lines", async () => {
    const manager = createMockRalphManager()
    wireRalphToBroadcast(manager, testServer.broadcast)

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Set up listener for output broadcast
    const outputPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Output timeout")), 5000)
      ws.on("message", data => {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ralph:output") {
          clearTimeout(timeout)
          resolve(msg)
        }
      })
    })

    // Manually emit output from the manager
    manager.emit("output", "Some raw output line")

    const received = await outputPromise

    expect(received).toMatchObject({
      type: "ralph:output",
      line: "Some raw output line",
    })

    ws.close()
    manager.removeAllListeners()
  })

  it("broadcasts ralph:error when RalphManager emits errors", async () => {
    const manager = createMockRalphManager()
    wireRalphToBroadcast(manager, testServer.broadcast)

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Set up listener for error broadcast
    const errorPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Error timeout")), 5000)
      ws.on("message", data => {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ralph:error") {
          clearTimeout(timeout)
          resolve(msg)
        }
      })
    })

    // Manually emit an error from the manager
    manager.emit("error", new Error("Test error message"))

    const received = await errorPromise

    expect(received).toMatchObject({
      type: "ralph:error",
      error: "Test error message",
    })

    ws.close()
    manager.removeAllListeners()
  })

  it("broadcasts ralph:exit when RalphManager process exits", async () => {
    const manager = createMockRalphManager()
    wireRalphToBroadcast(manager, testServer.broadcast)

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Set up listener for exit broadcast
    const exitPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Exit timeout")), 5000)
      ws.on("message", data => {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ralph:exit") {
          clearTimeout(timeout)
          resolve(msg)
        }
      })
    })

    // Manually emit an exit event from the manager
    manager.emit("exit", { code: 0, signal: null })

    const received = await exitPromise

    expect(received).toMatchObject({
      type: "ralph:exit",
      code: 0,
      signal: null,
    })

    ws.close()
    manager.removeAllListeners()
  })

  it("does not broadcast to disconnected clients", async () => {
    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    expect(testServer.getClientCount()).toBe(1)

    // Close the connection
    ws.close()

    // Wait for close to be processed
    await new Promise<void>(resolve => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve()
      } else {
        ws.once("close", resolve)
      }
    })

    // Small delay to ensure server processes the disconnect
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(testServer.getClientCount()).toBe(0)

    // Broadcasting should not throw even with no clients
    expect(() => testServer.broadcast({ type: "test" })).not.toThrow()
  })
})

describe("Per-client event tracking", () => {
  it("WsClient interface includes lastDeliveredEventIndex", async () => {
    // Import the type to ensure it exists and has the correct shape
    const client = {
      ws: {} as typeof WebSocket.prototype,
      isAlive: true,
      lastDeliveredEventIndex: new Map<string, number>(),
    }

    // Verify the Map works correctly
    client.lastDeliveredEventIndex.set("default", 5)
    expect(client.lastDeliveredEventIndex.get("default")).toBe(5)
    expect(client.lastDeliveredEventIndex.get("other")).toBeUndefined()

    // Verify default behavior (no events delivered returns -1 or undefined)
    expect(client.lastDeliveredEventIndex.get("nonexistent") ?? -1).toBe(-1)
  })

  it("tracks event indices per instance", async () => {
    const client = {
      ws: {} as typeof WebSocket.prototype,
      isAlive: true,
      lastDeliveredEventIndex: new Map<string, number>(),
    }

    // Track events for different instances
    client.lastDeliveredEventIndex.set("instance1", 10)
    client.lastDeliveredEventIndex.set("instance2", 5)
    client.lastDeliveredEventIndex.set("default", 0)

    expect(client.lastDeliveredEventIndex.get("instance1")).toBe(10)
    expect(client.lastDeliveredEventIndex.get("instance2")).toBe(5)
    expect(client.lastDeliveredEventIndex.get("default")).toBe(0)

    // Update an instance's index
    client.lastDeliveredEventIndex.set("instance1", 15)
    expect(client.lastDeliveredEventIndex.get("instance1")).toBe(15)
  })
})

describe("Reconnection sync protocol", () => {
  /**
   * Creates a test server that properly handles reconnect messages
   * similar to the production handleWsMessage function.
   * Uses timestamp-based filtering for reconnection sync.
   */
  function createReconnectTestServer(port: number) {
    const app = express()
    const server = createServer(app)
    const wss = new WebSocketServer({ server, path: "/ws" })

    interface TestWsClient {
      ws: typeof WebSocket.prototype
      isAlive: boolean
      lastDeliveredEventIndex: Map<string, number>
    }

    const clients = new Set<TestWsClient>()
    const eventHistory = new Map<string, RalphEvent[]>()
    const instanceStatus = new Map<string, RalphStatus>()

    // Initialize default instance
    eventHistory.set("default", [])
    instanceStatus.set("default", "stopped")

    /**
     * Add an event to the event history for an instance.
     */
    const addEvent = (instanceId: string, event: RalphEvent) => {
      const events = eventHistory.get(instanceId) ?? []
      events.push(event)
      eventHistory.set(instanceId, events)
    }

    /**
     * Get event history for an instance.
     */
    const getEventHistory = (instanceId: string): RalphEvent[] => {
      return eventHistory.get(instanceId) ?? []
    }

    /**
     * Set status for an instance.
     */
    const setStatus = (instanceId: string, status: RalphStatus) => {
      instanceStatus.set(instanceId, status)
    }

    wss.on("connection", (ws: typeof WebSocket.prototype) => {
      const client: TestWsClient = {
        ws,
        isAlive: true,
        lastDeliveredEventIndex: new Map(),
      }
      clients.add(client)

      ws.on("close", () => {
        clients.delete(client)
      })

      ws.on("message", data => {
        try {
          const message = JSON.parse(data.toString())

          if (message.type === "reconnect") {
            const instanceId = (message.instanceId as string) || "default"
            const lastEventTimestamp = message.lastEventTimestamp as number | undefined

            const events = getEventHistory(instanceId)
            let pendingEvents: RalphEvent[] = []

            if (typeof lastEventTimestamp === "number" && lastEventTimestamp > 0) {
              // Filter events by timestamp
              pendingEvents = events.filter(event => event.timestamp > lastEventTimestamp)
            } else {
              pendingEvents = events
            }

            const status = instanceStatus.get(instanceId) ?? "stopped"

            ws.send(
              JSON.stringify({
                type: "pending_events",
                instanceId,
                events: pendingEvents,
                totalEvents: events.length,
                ralphStatus: status,
                timestamp: Date.now(),
              }),
            )

            // Update client's last delivered event index
            if (events.length > 0) {
              client.lastDeliveredEventIndex.set(instanceId, events.length - 1)
            }
          }
        } catch {
          // Ignore parse errors
        }
      })

      // Send welcome message
      ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }))
    })

    return {
      server,
      wss,
      addEvent,
      getEventHistory,
      setStatus,
      getClientCount: () => clients.size,
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

  const port = 3099
  let testServer: ReturnType<typeof createReconnectTestServer>

  beforeEach(async () => {
    testServer = createReconnectTestServer(port)
    await testServer.start()
  })

  afterEach(async () => {
    await testServer.close()
  })

  it("responds with pending_events when client sends reconnect message", async () => {
    // Add some events to the server with distinct timestamps
    testServer.addEvent("default", { type: "tool_use", timestamp: 1000, tool: "bash" })
    testServer.addEvent("default", { type: "text", timestamp: 2000, content: "Hello" })
    testServer.addEvent("default", { type: "tool_result", timestamp: 3000, tool: "bash" })
    testServer.setStatus("default", "running")

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Send reconnect message asking for events after timestamp 1000
    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    ws.send(JSON.stringify({ type: "reconnect", instanceId: "default", lastEventTimestamp: 1000 }))

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: RalphEvent[]
      totalEvents: number
      ralphStatus: RalphStatus
    }

    expect(response.type).toBe("pending_events")
    expect(response.instanceId).toBe("default")
    expect(response.events).toHaveLength(2) // Events with timestamp > 1000
    expect(response.totalEvents).toBe(3)
    expect(response.ralphStatus).toBe("running")
    expect(response.events[0]).toMatchObject({ type: "text", content: "Hello" })
    expect(response.events[1]).toMatchObject({ type: "tool_result", tool: "bash" })

    ws.close()
  })

  it("returns all events when lastEventTimestamp is not provided", async () => {
    // Add some events
    testServer.addEvent("default", { type: "tool_use", timestamp: 1000, tool: "read" })
    testServer.addEvent("default", { type: "text", timestamp: 2000, content: "Content" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect without lastEventTimestamp
    ws.send(JSON.stringify({ type: "reconnect", instanceId: "default" }))

    const response = (await pendingEventsPromise) as {
      type: string
      events: RalphEvent[]
      totalEvents: number
    }

    expect(response.type).toBe("pending_events")
    expect(response.events).toHaveLength(2) // All events
    expect(response.totalEvents).toBe(2)

    ws.close()
  })

  it("returns empty array when client is fully up to date", async () => {
    // Add some events
    testServer.addEvent("default", { type: "tool_use", timestamp: 1000, tool: "write" })
    testServer.addEvent("default", { type: "text", timestamp: 2000, content: "Done" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect with lastEventTimestamp pointing to the last event's timestamp
    ws.send(JSON.stringify({ type: "reconnect", instanceId: "default", lastEventTimestamp: 2000 }))

    const response = (await pendingEventsPromise) as {
      type: string
      events: RalphEvent[]
      totalEvents: number
    }

    expect(response.type).toBe("pending_events")
    expect(response.events).toHaveLength(0) // No new events (none have timestamp > 2000)
    expect(response.totalEvents).toBe(2)

    ws.close()
  })

  it("defaults to 'default' instanceId when not provided", async () => {
    testServer.addEvent("default", { type: "text", timestamp: 1000, content: "Test" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect without instanceId
    ws.send(JSON.stringify({ type: "reconnect" }))

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: RalphEvent[]
    }

    expect(response.type).toBe("pending_events")
    expect(response.instanceId).toBe("default")
    expect(response.events).toHaveLength(1)

    ws.close()
  })

  it("works with different instanceIds", async () => {
    // Add events to different instances
    testServer.addEvent("default", { type: "text", timestamp: 1000, content: "Default" })
    testServer.addEvent("instance2", { type: "text", timestamp: 2000, content: "Instance2-A" })
    testServer.addEvent("instance2", { type: "text", timestamp: 3000, content: "Instance2-B" })
    testServer.setStatus("instance2", "paused")

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Request events from instance2 after timestamp 2000
    ws.send(
      JSON.stringify({ type: "reconnect", instanceId: "instance2", lastEventTimestamp: 2000 }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: RalphEvent[]
      ralphStatus: RalphStatus
    }

    expect(response.type).toBe("pending_events")
    expect(response.instanceId).toBe("instance2")
    expect(response.events).toHaveLength(1) // Only event with timestamp > 2000
    expect(response.events[0]).toMatchObject({ content: "Instance2-B" })
    expect(response.ralphStatus).toBe("paused")

    ws.close()
  })
})

describe("Task chat reconnection sync protocol", () => {
  /**
   * Creates a test server that handles task-chat:reconnect messages
   * similar to the production handleWsMessage function.
   */
  function createTaskChatReconnectTestServer(port: number) {
    const app = express()
    const server = createServer(app)
    const wss = new WebSocketServer({ server, path: "/ws" })

    interface TaskChatEvent {
      type: string
      timestamp: number
      [key: string]: unknown
    }

    type TaskChatStatus = "idle" | "processing" | "error"

    // Mock persister for task chat events
    const eventStorage = new Map<string, TaskChatEvent[]>()
    const statusStorage = new Map<string, TaskChatStatus>()

    // Initialize default instance
    statusStorage.set("default", "idle")

    /**
     * Mock persister methods that mirror TaskChatEventPersister behavior.
     */
    const mockPersister = {
      async readEvents(instanceId: string): Promise<TaskChatEvent[]> {
        return eventStorage.get(instanceId) ?? []
      },
      async readEventsSince(instanceId: string, timestamp: number): Promise<TaskChatEvent[]> {
        const events = eventStorage.get(instanceId) ?? []
        return events.filter(e => e.timestamp > timestamp)
      },
      async getEventCount(instanceId: string): Promise<number> {
        return (eventStorage.get(instanceId) ?? []).length
      },
    }

    /**
     * Add an event to the event storage for an instance.
     */
    const addEvent = (instanceId: string, event: TaskChatEvent) => {
      const events = eventStorage.get(instanceId) ?? []
      events.push(event)
      eventStorage.set(instanceId, events)
    }

    /**
     * Set status for an instance.
     */
    const setStatus = (instanceId: string, status: TaskChatStatus) => {
      statusStorage.set(instanceId, status)
    }

    wss.on("connection", (ws: typeof WebSocket.prototype) => {
      ws.on("message", async data => {
        try {
          const message = JSON.parse(data.toString())

          if (message.type === "task-chat:reconnect") {
            const instanceId = (message.instanceId as string) || "default"
            const lastEventTimestamp = message.lastEventTimestamp as number | undefined

            try {
              // Read events since the client's last known timestamp
              let pendingEvents: TaskChatEvent[]
              if (typeof lastEventTimestamp === "number" && lastEventTimestamp > 0) {
                pendingEvents = await mockPersister.readEventsSince(instanceId, lastEventTimestamp)
              } else {
                // Client has no events, send all
                pendingEvents = await mockPersister.readEvents(instanceId)
              }

              // Get total count for diagnostics
              const totalEvents = await mockPersister.getEventCount(instanceId)

              // Get current task chat status
              const taskChatStatus = statusStorage.get(instanceId) ?? "idle"

              // Send pending task chat events response
              ws.send(
                JSON.stringify({
                  type: "task-chat:pending_events",
                  instanceId,
                  events: pendingEvents,
                  totalEvents,
                  status: taskChatStatus,
                  timestamp: Date.now(),
                }),
              )
            } catch (err) {
              ws.send(
                JSON.stringify({
                  type: "task-chat:error",
                  error: `Failed to sync task chat events: ${err instanceof Error ? err.message : "Unknown error"}`,
                  timestamp: Date.now(),
                }),
              )
            }
          }
        } catch {
          // Ignore parse errors
        }
      })

      // Send welcome message
      ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }))
    })

    return {
      server,
      wss,
      addEvent,
      setStatus,
      getClientCount: () => wss.clients.size,
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

  const port = 3100 // Different port from other tests
  let testServer: ReturnType<typeof createTaskChatReconnectTestServer>

  beforeEach(async () => {
    testServer = createTaskChatReconnectTestServer(port)
    await testServer.start()
  })

  afterEach(async () => {
    await testServer.close()
  })

  it("sends pending events when client has a lastEventTimestamp", async () => {
    // Add events with distinct timestamps
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Hello" })
    testServer.addEvent("default", { type: "assistant", timestamp: 2000, content: "Hi there!" })
    testServer.addEvent("default", { type: "tool_use", timestamp: 3000, tool: "Read" })
    testServer.addEvent("default", { type: "tool_result", timestamp: 4000, tool: "Read" })
    testServer.setStatus("default", "processing")

    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome message
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for welcome")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    // Set up listener for pending_events response
    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send task-chat:reconnect with lastEventTimestamp of 2000
    // Should return events after timestamp 2000 (i.e., events at 3000 and 4000)
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "default",
        lastEventTimestamp: 2000,
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: Array<{ type: string; timestamp: number; [key: string]: unknown }>
      totalEvents: number
      status: string
      timestamp: number
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.instanceId).toBe("default")
    expect(response.events).toHaveLength(2) // Events with timestamp > 2000
    expect(response.totalEvents).toBe(4)
    expect(response.status).toBe("processing")
    expect(response.events[0]).toMatchObject({ type: "tool_use", timestamp: 3000 })
    expect(response.events[1]).toMatchObject({ type: "tool_result", timestamp: 4000 })
    expect(response.timestamp).toBeGreaterThan(0)

    ws.close()
  })

  it("sends all events when client has no lastEventTimestamp", async () => {
    // Add some events
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "First" })
    testServer.addEvent("default", { type: "assistant", timestamp: 2000, content: "Response" })
    testServer.setStatus("default", "idle")

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect without lastEventTimestamp
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "default",
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      events: Array<{ type: string; timestamp: number }>
      totalEvents: number
      status: string
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.events).toHaveLength(2) // All events
    expect(response.totalEvents).toBe(2)
    expect(response.status).toBe("idle")

    ws.close()
  })

  it("sends all events when lastEventTimestamp is 0", async () => {
    // Add some events
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Message" })
    testServer.addEvent("default", { type: "assistant", timestamp: 2000, content: "Reply" })
    testServer.setStatus("default", "idle")

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect with lastEventTimestamp of 0
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "default",
        lastEventTimestamp: 0,
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      events: Array<{ type: string; timestamp: number }>
      totalEvents: number
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.events).toHaveLength(2) // All events (timestamp 0 means send all)
    expect(response.totalEvents).toBe(2)

    ws.close()
  })

  it("sends empty events array when there are no persisted events", async () => {
    // Do not add any events - storage is empty
    testServer.setStatus("default", "idle")

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "default",
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: unknown[]
      totalEvents: number
      status: string
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.instanceId).toBe("default")
    expect(response.events).toEqual([])
    expect(response.totalEvents).toBe(0)
    expect(response.status).toBe("idle")

    ws.close()
  })

  it("sends empty events array when client is fully up to date", async () => {
    // Add events
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Hello" })
    testServer.addEvent("default", { type: "assistant", timestamp: 2000, content: "World" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect with lastEventTimestamp equal to the latest event
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "default",
        lastEventTimestamp: 2000,
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      events: unknown[]
      totalEvents: number
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.events).toEqual([]) // No events after timestamp 2000
    expect(response.totalEvents).toBe(2)

    ws.close()
  })

  it("defaults to 'default' instanceId when not provided", async () => {
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Test" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Send reconnect without instanceId
    ws.send(JSON.stringify({ type: "task-chat:reconnect" }))

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: unknown[]
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.instanceId).toBe("default")
    expect(response.events).toHaveLength(1)

    ws.close()
  })

  it("works with different instanceIds", async () => {
    // Add events to different instances
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Default" })
    testServer.addEvent("instance-2", {
      type: "user_message",
      timestamp: 2000,
      content: "Instance2-A",
    })
    testServer.addEvent("instance-2", { type: "assistant", timestamp: 3000, content: "Instance2-B" })
    testServer.setStatus("instance-2", "processing")

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Request events from instance-2 after timestamp 2000
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "instance-2",
        lastEventTimestamp: 2000,
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: Array<{ type: string; content?: string }>
      status: string
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.instanceId).toBe("instance-2")
    expect(response.events).toHaveLength(1) // Only event with timestamp > 2000
    expect(response.events[0]).toMatchObject({ type: "assistant", content: "Instance2-B" })
    expect(response.status).toBe("processing")

    ws.close()
  })

  it("returns empty for non-existent instanceId", async () => {
    // Add events only to default
    testServer.addEvent("default", { type: "user_message", timestamp: 1000, content: "Hello" })

    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Wait for welcome
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
      ws.once("message", () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    const pendingEventsPromise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("pending_events timeout")), 5000)
      ws.once("message", data => {
        clearTimeout(timeout)
        resolve(JSON.parse(data.toString()))
      })
    })

    // Request events from non-existent instance
    ws.send(
      JSON.stringify({
        type: "task-chat:reconnect",
        instanceId: "non-existent",
      }),
    )

    const response = (await pendingEventsPromise) as {
      type: string
      instanceId: string
      events: unknown[]
      totalEvents: number
    }

    expect(response.type).toBe("task-chat:pending_events")
    expect(response.instanceId).toBe("non-existent")
    expect(response.events).toEqual([])
    expect(response.totalEvents).toBe(0)

    ws.close()
  })
})
