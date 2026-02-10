import { describe, it, expect, vi } from "vitest"
import express, { type Express } from "express"
import { createServer, type Server } from "node:http"
import { registerOrchestratorRoutes } from "../routes/orchestratorRoutes.js"
import type { WorkerOrchestratorManager } from "../lib/WorkerOrchestratorManager.js"
import type { OrchestratorState, WorkerInfo } from "../lib/WorkerOrchestrator.js"

/**
 * Create a mock orchestrator for testing.
 */
function createMockOrchestrator(): Record<string, unknown> & WorkerOrchestratorManager {
  const state: { current: OrchestratorState } = { current: "stopped" }
  const workerStates: Record<string, WorkerInfo> = {}

  return {
    getState: vi.fn(() => state.current),
    getMaxWorkers: vi.fn(() => 3),
    getActiveWorkerCount: vi.fn(() => Object.keys(workerStates).length),
    getWorkerNames: vi.fn(() => Object.keys(workerStates)),
    getWorkerStates: vi.fn(() => workerStates),
    getWorkerState: vi.fn((name: string) => workerStates[name]?.state ?? null),
    start: vi.fn(async () => {
      state.current = "running"
    }),
    stop: vi.fn(async () => {
      state.current = "stopped"
    }),
    stopAfterCurrent: vi.fn(() => {
      state.current = "stopping"
    }),
    cancelStopAfterCurrent: vi.fn(async () => {
      if (state.current === "stopping") {
        state.current = "running"
      }
    }),
    pauseWorker: vi.fn((name: string) => {
      if (workerStates[name]) {
        workerStates[name].state = "paused"
      }
    }),
    resumeWorker: vi.fn((name: string) => {
      if (workerStates[name]) {
        workerStates[name].state = "running"
      }
    }),
    stopWorker: vi.fn((name: string) => {
      delete workerStates[name]
    }),
    // Helper to add workers for testing
    _addWorker: (name: string, taskId: string | null = null) => {
      workerStates[name] = { workerName: name, state: "running", currentTaskId: taskId }
    },
  } as unknown as Record<string, unknown> & WorkerOrchestratorManager
}

/**
 * Setup test server.
 */
function setupTestServer(orchestrator: WorkerOrchestratorManager | null): {
  app: Express
  server: Server
  baseUrl: string
  close: () => Promise<void>
} {
  const app = express()
  app.use(express.json())

  registerOrchestratorRoutes(app, {
    getOrchestrator: () => orchestrator,
  })

  const server = createServer(app)

  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number }
      const baseUrl = `http://127.0.0.1:${addr.port}`
      resolve({
        app,
        server,
        baseUrl,
        close: () => new Promise<void>(res => server.close(() => res())),
      })
    })
  }) as unknown as {
    app: Express
    server: Server
    baseUrl: string
    close: () => Promise<void>
  }
}

describe("orchestratorRoutes", () => {
  describe("orchestrator endpoints", () => {
    it("GET /api/orchestrator returns state", async () => {
      const mockOrchestrator = createMockOrchestrator()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator`)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          state: "stopped",
          maxWorkers: 3,
          activeWorkerCount: 0,
        })
      } finally {
        await close()
      }
    })

    it("GET /api/orchestrator returns 404 when no orchestrator", async () => {
      const { baseUrl, close } = await setupTestServer(null)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator`)
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Orchestrator not configured" })
      } finally {
        await close()
      }
    })

    it("POST /api/orchestrator/start starts the orchestrator", async () => {
      const mockOrchestrator = createMockOrchestrator()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator/start`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          state: "running",
        })
        expect(mockOrchestrator.start).toHaveBeenCalled()
      } finally {
        await close()
      }
    })

    it("POST /api/orchestrator/stop stops the orchestrator", async () => {
      const mockOrchestrator = createMockOrchestrator()
      await mockOrchestrator.start()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator/stop`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          state: "stopped",
        })
        expect(mockOrchestrator.stop).toHaveBeenCalled()
      } finally {
        await close()
      }
    })

    it("POST /api/orchestrator/stop-after-current sets stopping state", async () => {
      const mockOrchestrator = createMockOrchestrator()
      await mockOrchestrator.start()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator/stop-after-current`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          state: "stopping",
        })
        expect(mockOrchestrator.stopAfterCurrent).toHaveBeenCalled()
      } finally {
        await close()
      }
    })

    it("POST /api/orchestrator/cancel-stop cancels pending stop", async () => {
      const mockOrchestrator = createMockOrchestrator()
      await mockOrchestrator.start()
      mockOrchestrator.stopAfterCurrent()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/orchestrator/cancel-stop`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          state: "running",
        })
        expect(mockOrchestrator.cancelStopAfterCurrent).toHaveBeenCalled()
      } finally {
        await close()
      }
    })
  })

  describe("worker endpoints", () => {
    it("GET /api/workers returns empty list initially", async () => {
      const mockOrchestrator = createMockOrchestrator()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers`)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ workers: {} })
      } finally {
        await close()
      }
    })

    it("GET /api/workers returns worker states", async () => {
      const mockOrchestrator = createMockOrchestrator()
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("homer", "task-1")
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("marge", "task-2")
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers`)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.workers).toEqual({
          homer: { workerName: "homer", state: "running", currentTaskId: "task-1" },
          marge: { workerName: "marge", state: "running", currentTaskId: "task-2" },
        })
      } finally {
        await close()
      }
    })

    it("GET /api/workers/:name returns 404 for non-existent worker", async () => {
      const mockOrchestrator = createMockOrchestrator()
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers/nonexistent`)
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: 'Worker "nonexistent" not found' })
      } finally {
        await close()
      }
    })

    it("GET /api/workers/:name returns worker info", async () => {
      const mockOrchestrator = createMockOrchestrator()
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("homer", "task-1")
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers/homer`)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          workerName: "homer",
          state: "running",
          currentTaskId: "task-1",
        })
      } finally {
        await close()
      }
    })

    it("POST /api/workers/:name/pause pauses a worker", async () => {
      const mockOrchestrator = createMockOrchestrator()
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("homer", "task-1")
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers/homer/pause`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          workerName: "homer",
          state: "paused",
        })
        expect(mockOrchestrator.pauseWorker).toHaveBeenCalledWith("homer")
      } finally {
        await close()
      }
    })

    it("POST /api/workers/:name/resume resumes a worker", async () => {
      const mockOrchestrator = createMockOrchestrator()
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("homer", "task-1")
      mockOrchestrator.pauseWorker("homer")
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers/homer/resume`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          workerName: "homer",
          state: "running",
        })
        expect(mockOrchestrator.resumeWorker).toHaveBeenCalledWith("homer")
      } finally {
        await close()
      }
    })

    it("POST /api/workers/:name/stop stops a worker", async () => {
      const mockOrchestrator = createMockOrchestrator()
      ;(mockOrchestrator as Record<string, unknown>)._addWorker("homer", "task-1")
      const { baseUrl, close } = await setupTestServer(mockOrchestrator)

      try {
        const res = await fetch(`${baseUrl}/api/workers/homer/stop`, { method: "POST" })
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({
          ok: true,
          workerName: "homer",
        })
        expect(mockOrchestrator.stopWorker).toHaveBeenCalledWith("homer")
      } finally {
        await close()
      }
    })
  })
})
