import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server } from "node:http"
import express from "express"
import { WebSocketServer, WebSocket } from "ws"

describe("server", () => {
  let server: Server
  let wss: WebSocketServer
  const port = 3099 // Use a different port for tests

  beforeAll(async () => {
    const app = express()

    app.get("/healthz", (_req, res) => {
      res.status(200).json({ ok: true })
    })

    server = createServer(app)
    wss = new WebSocketServer({ server, path: "/ws" })

    wss.on("connection", ws => {
      ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }))
      ws.on("message", data => {
        const message = JSON.parse(data.toString())
        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
        }
      })
    })

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    // Close all existing WebSocket connections first
    for (const client of wss.clients) {
      client.terminate()
    }
    wss.close()
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"))
      }, 5000)
      server.close(err => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      })
    })
  })

  it("health endpoint returns ok", async () => {
    const response = await fetch(`http://localhost:${port}/healthz`)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data).toEqual({ ok: true })
  })

  it("WebSocket connects and receives welcome message", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    try {
      const message = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000)
        ws.once("message", data => {
          clearTimeout(timeout)
          resolve(JSON.parse(data.toString()))
        })
        ws.once("error", err => {
          clearTimeout(timeout)
          reject(err)
        })
      })

      expect(message).toHaveProperty("type", "connected")
      expect(message).toHaveProperty("timestamp")
    } finally {
      ws.close()
      // Wait for close to complete
      if (ws.readyState !== WebSocket.CLOSED) {
        await new Promise<void>(resolve => ws.once("close", resolve))
      }
    }
  })

  it("WebSocket responds to ping with pong", async () => {
    // Create a fresh WebSocket connection
    const ws = new WebSocket(`ws://localhost:${port}/ws`)

    // Collect all messages
    const messages: string[] = []

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout - received messages: ${JSON.stringify(messages)}`))
      }, 5000)

      ws.on("message", data => {
        const text = data.toString()
        messages.push(text)
        const msg = JSON.parse(text)

        // After receiving welcome, send ping
        if (msg.type === "connected") {
          ws.send(JSON.stringify({ type: "ping" }))
        }

        // When we get pong, we're done
        if (msg.type === "pong") {
          clearTimeout(timeout)
          resolve()
        }
      })

      ws.on("error", err => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    expect(messages).toHaveLength(2)
    const pong = JSON.parse(messages[1])
    expect(pong).toHaveProperty("type", "pong")
    expect(pong).toHaveProperty("timestamp")

    ws.close()
  })
})
