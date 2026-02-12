import { describe, it, expect } from "vitest"
import express, { type Express } from "express"
import { createServer, type Server } from "node:http"
import { registerRalphRoutes } from "../ralphRoutes.js"

/** Start an HTTP server with Ralph routes for testing. */
async function createTestServer(): Promise<{
  app: Express
  server: Server
  baseUrl: string
  close: () => Promise<void>
}> {
  const app = express()
  app.use(express.json())
  registerRalphRoutes(app)

  const server = createServer(app)

  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      resolve()
    })
  })

  const address = server.address() as { port: number }
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    app,
    server,
    baseUrl,
    close: async () => {
      await new Promise<void>(resolve => {
        server.close(() => resolve())
      })
    },
  }
}

describe("registerRalphRoutes", () => {
  it("registers /api/orchestrator via orchestrator routes", async () => {
    const { baseUrl, close } = await createTestServer()

    try {
      const res = await fetch(`${baseUrl}/api/orchestrator`)
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: "Orchestrator not configured" })
    } finally {
      await close()
    }
  })

  it("registers /api/workers via orchestrator routes", async () => {
    const { baseUrl, close } = await createTestServer()

    try {
      const res = await fetch(`${baseUrl}/api/workers`)
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body).toEqual({ error: "Orchestrator not configured" })
    } finally {
      await close()
    }
  })
})
