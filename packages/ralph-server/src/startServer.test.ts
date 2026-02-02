import { describe, it, expect, afterEach } from "vitest"
import { startServer, findAvailablePort } from "./index.js"
import type { AgentServerConfig } from "./types.js"
import WebSocket from "ws"

describe("startServer", () => {
  let close: (() => Promise<void>) | undefined

  afterEach(async () => {
    if (close) {
      await close()
      close = undefined
    }
  })

  const getTestConfig = async (): Promise<AgentServerConfig> => ({
    host: "localhost",
    port: await findAvailablePort("localhost", 14244),
    workspacePath: "/tmp/test-workspace",
  })

  it("starts and responds to /healthz", async () => {
    const config = await getTestConfig()
    const result = await startServer(config)
    close = result.close

    const res = await fetch(`http://${config.host}:${config.port}/healthz`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, server: "ralph-server" })
  })

  it("accepts WebSocket connections and sends connected message", async () => {
    const config = await getTestConfig()
    const result = await startServer(config)
    close = result.close

    const msg = await new Promise<object>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("message", data => {
        resolve(JSON.parse(data.toString()))
        ws.close()
      })
      ws.on("error", reject)
    })

    expect(msg).toEqual({ type: "connected" })
  })

  it("responds to ping with pong", async () => {
    const config = await getTestConfig()
    const result = await startServer(config)
    close = result.close

    const msg = await new Promise<object>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("open", () => {
        // Skip the initial "connected" message, then send ping
        ws.once("message", () => {
          ws.send(JSON.stringify({ type: "ping" }))
          ws.once("message", data => {
            resolve(JSON.parse(data.toString()))
            ws.close()
          })
        })
      })
      ws.on("error", reject)
    })

    expect(msg).toEqual({ type: "pong" })
  })

  it("gracefully shuts down and closes WebSocket connections", async () => {
    const config = await getTestConfig()
    const result = await startServer(config)

    const closed = new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("open", async () => {
        // Wait for connected message before shutting down
        ws.once("message", async () => {
          await result.close()
        })
      })
      ws.on("close", code => resolve(code))
      ws.on("error", reject)
    })

    const code = await closed
    // Server-initiated close typically sends 1001 (going away) or similar
    expect(typeof code).toBe("number")
  })
})

describe("findAvailablePort", () => {
  it("returns the start port when it is available", async () => {
    // Use a high port unlikely to be in use
    const port = await findAvailablePort("localhost", 19876)
    expect(port).toBe(19876)
  })

  it("skips ports that are in use", async () => {
    // Occupy a port, then verify findAvailablePort skips it
    const { createServer } = await import("node:http")
    const blocker = createServer()

    const blockedPort = await findAvailablePort("localhost", 19877)
    await new Promise<void>(resolve => {
      blocker.listen(blockedPort, "localhost", () => resolve())
    })

    try {
      const port = await findAvailablePort("localhost", blockedPort)
      expect(port).toBeGreaterThan(blockedPort)
    } finally {
      await new Promise<void>(resolve => {
        blocker.close(() => resolve())
      })
    }
  })
})
