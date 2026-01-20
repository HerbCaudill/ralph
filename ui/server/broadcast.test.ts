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
function createTestServer(port: number) {
  const app = express()
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: "/ws" })
  const clients = new Set<WsClient>()

  // Broadcast function matching production implementation
  const broadcast = (message: unknown) => {
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
 */
function wireRalphToBroadcast(manager: RalphManager, broadcast: (msg: unknown) => void) {
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
