import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import WebSocket from "ws"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Mock beads SDK dependencies to avoid needing a running daemon
vi.mock("@herbcaudill/beads-sdk", () => ({
  batched: vi.fn(async (items: any[], _max: number, fn: Function) => Promise.all(items.map(fn))),
  MAX_CONCURRENT_REQUESTS: 5,
}))

vi.mock("@herbcaudill/beads-sdk/node", () => ({
  BeadsClient: class {
    getInfo = vi.fn().mockResolvedValue({
      database_path: "/tmp/test-workspace/.beads/beads.db",
      daemon_connected: true,
      daemon_status: "running",
      config: { issue_prefix: "t" },
    })
    list = vi.fn().mockResolvedValue([])
  },
  CliTransport: class {
    send = vi.fn().mockResolvedValue([])
  },
  DaemonTransport: class {
    send = vi.fn().mockResolvedValue([])
  },
  watchMutations: vi.fn().mockReturnValue(() => {}),
  getAliveWorkspaces: vi.fn().mockReturnValue([]),
}))

vi.mock("@herbcaudill/beads-view/server", () => ({
  registerTaskRoutes: vi.fn(),
}))

import { startServer, findAvailablePort } from ".././index.js"
import type { BeadsServerConfig } from ".././types.js"

describe("startServer", () => {
  let server: Awaited<ReturnType<typeof import("node:http").createServer>> | undefined
  let tempDir: string | undefined
  const originalWorkspacePath = process.env.WORKSPACE_PATH

  const getTestConfig = async (): Promise<BeadsServerConfig> => ({
    host: "localhost",
    port: await findAvailablePort("localhost", 18500),
    enableMutationPolling: false,
  })

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server!.close(() => resolve())
      })
      server = undefined
    }
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true })
      tempDir = undefined
    }
    if (originalWorkspacePath !== undefined) {
      process.env.WORKSPACE_PATH = originalWorkspacePath
    } else {
      delete process.env.WORKSPACE_PATH
    }
  })

  it("starts and responds to /healthz", async () => {
    const config = await getTestConfig()
    server = await startServer(config)

    const res = await fetch(`http://${config.host}:${config.port}/healthz`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, server: "beads-server" })
  })

  it("accepts WebSocket connections and sends connected message", async () => {
    const config = await getTestConfig()
    server = await startServer(config)

    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("message", data => {
        resolve(JSON.parse(data.toString()))
        ws.close()
      })
      ws.on("error", reject)
    })

    expect(msg.type).toBe("connected")
    expect(msg.server).toBe("beads-server")
  })

  it("responds to ping with pong", async () => {
    const config = await getTestConfig()
    server = await startServer(config)

    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
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

    expect(msg.type).toBe("pong")
    expect(msg.timestamp).toEqual(expect.any(Number))
  })

  it("lists sibling Beads workspaces when the registry is empty", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "beads-workspaces-"))
    const currentWorkspace = join(tempDir, "ralph")
    const siblingWorkspace = join(tempDir, "dotfiles")
    await mkdir(join(currentWorkspace, ".beads"), { recursive: true })
    await mkdir(join(siblingWorkspace, ".beads"), { recursive: true })
    process.env.WORKSPACE_PATH = currentWorkspace

    const config = await getTestConfig()
    server = await startServer(config)

    const res = await fetch(`http://${config.host}:${config.port}/api/workspaces`)
    const body = (await res.json()) as {
      workspaces: Array<{ path: string; name: string }>
    }

    expect(body.workspaces.map(ws => ws.path).sort()).toEqual(
      [currentWorkspace, siblingWorkspace].sort(),
    )
  })

  it("handles workspace subscription", async () => {
    const config = await getTestConfig()
    server = await startServer(config)

    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("open", () => {
        ws.once("message", () => {
          ws.send(JSON.stringify({ type: "ws:subscribe_workspace", workspaceId: "test-workspace" }))
          ws.once("message", data => {
            resolve(JSON.parse(data.toString()))
            ws.close()
          })
        })
      })
      ws.on("error", reject)
    })

    expect(msg.type).toBe("ws:subscribed")
    expect(msg.workspace).toBe("test-workspace")
  })

  it("ignores invalid JSON messages", async () => {
    const config = await getTestConfig()
    server = await startServer(config)

    // Send invalid JSON and verify the connection stays alive
    const alive = await new Promise<boolean>((resolve, reject) => {
      const ws = new WebSocket(`ws://${config.host}:${config.port}/ws`)
      ws.on("open", () => {
        ws.once("message", () => {
          // Send garbage
          ws.send("not valid json {{{")
          // Then send a valid ping to prove connection still works
          setTimeout(() => {
            ws.send(JSON.stringify({ type: "ping" }))
            ws.once("message", data => {
              const msg = JSON.parse(data.toString())
              resolve(msg.type === "pong")
              ws.close()
            })
          }, 50)
        })
      })
      ws.on("error", reject)
    })

    expect(alive).toBe(true)
  })
})

describe("findAvailablePort", () => {
  it("returns the start port when it is available", async () => {
    const port = await findAvailablePort("localhost", 18600)
    expect(port).toBe(18600)
  })

  it("skips ports that are in use", async () => {
    const { createServer } = await import("node:http")
    const blocker = createServer()

    const blockedPort = await findAvailablePort("localhost", 18601)
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

  it("throws when all ports are exhausted", async () => {
    const { createServer } = await import("node:http")
    const blockers: ReturnType<typeof createServer>[] = []
    const basePort = 18610

    // Block 3 ports
    for (let i = 0; i < 3; i++) {
      const s = createServer()
      await new Promise<void>(resolve => {
        s.listen(basePort + i, "localhost", () => resolve())
      })
      blockers.push(s)
    }

    try {
      await expect(findAvailablePort("localhost", basePort, 3)).rejects.toThrow(
        /No available port found/,
      )
    } finally {
      await Promise.all(blockers.map(s => new Promise<void>(resolve => s.close(() => resolve()))))
    }
  })
})
