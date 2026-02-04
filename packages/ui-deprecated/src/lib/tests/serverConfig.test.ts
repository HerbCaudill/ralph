import { describe, it, expect, beforeEach } from "vitest"

// The functions read import.meta.env at call time (not at module load time),
// so we can simply mutate import.meta.env between tests.

describe("serverConfig", () => {
  beforeEach(() => {
    // Reset env to original state before each test
    for (const key of Object.keys(import.meta.env)) {
      if (
        key.startsWith("VITE_BEADS") ||
        key.startsWith("VITE_AGENT") ||
        key.startsWith("VITE_SPLIT")
      ) {
        delete (import.meta.env as Record<string, unknown>)[key]
      }
    }
  })

  // Stub window.location for buildWsUrl
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        host: "localhost:5173",
      },
      writable: true,
      configurable: true,
    })
  })

  describe("isSplitServerMode", () => {
    // Import at top level is fine since isSplitServerMode reads env at call time
    let isSplitServerMode: typeof import(".././serverConfig").isSplitServerMode

    beforeEach(async () => {
      const mod = await import(".././serverConfig")
      isSplitServerMode = mod.isSplitServerMode
    })

    it("returns false in combined mode (default, no env vars)", () => {
      expect(isSplitServerMode()).toBe(false)
    })

    it("returns true when VITE_SPLIT_SERVERS is 'true'", () => {
      import.meta.env.VITE_SPLIT_SERVERS = "true"
      expect(isSplitServerMode()).toBe(true)
    })

    it("returns true when VITE_BEADS_SERVER_URL is set", () => {
      import.meta.env.VITE_BEADS_SERVER_URL = "http://localhost:4243"
      expect(isSplitServerMode()).toBe(true)
    })

    it("returns true when VITE_AGENT_SERVER_URL is set", () => {
      import.meta.env.VITE_AGENT_SERVER_URL = "http://localhost:4244"
      expect(isSplitServerMode()).toBe(true)
    })

    it("returns false when VITE_SPLIT_SERVERS is not 'true'", () => {
      import.meta.env.VITE_SPLIT_SERVERS = "false"
      expect(isSplitServerMode()).toBe(false)
    })
  })

  describe("getServerUrls", () => {
    let getServerUrls: typeof import(".././serverConfig").getServerUrls

    beforeEach(async () => {
      const mod = await import(".././serverConfig")
      getServerUrls = mod.getServerUrls
    })

    describe("combined mode (default)", () => {
      it("returns empty HTTP bases, null beadsWs, and ws:// agentWs", () => {
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("")
        expect(urls.agentHttp).toBe("")
        expect(urls.beadsWs).toBeNull()
        expect(urls.agentWs).toBe("ws://localhost:5173/ws")
      })

      it("uses wss: when page is served over https", () => {
        Object.defineProperty(window, "location", {
          value: { protocol: "https:", host: "example.com" },
          writable: true,
          configurable: true,
        })
        const urls = getServerUrls()
        expect(urls.agentWs).toBe("wss://example.com/ws")
        expect(urls.beadsWs).toBeNull()
      })
    })

    describe("split mode via VITE_SPLIT_SERVERS", () => {
      it("returns separate beadsWs at /beads-ws and agentWs at /ws", () => {
        import.meta.env.VITE_SPLIT_SERVERS = "true"
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("")
        expect(urls.agentHttp).toBe("")
        expect(urls.beadsWs).toBe("ws://localhost:5173/beads-ws")
        expect(urls.agentWs).toBe("ws://localhost:5173/ws")
      })
    })

    describe("split mode via explicit URLs", () => {
      it("returns direct URLs when both server URLs are provided", () => {
        import.meta.env.VITE_BEADS_SERVER_URL = "http://localhost:4243"
        import.meta.env.VITE_AGENT_SERVER_URL = "http://localhost:4244"
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("http://localhost:4243")
        expect(urls.agentHttp).toBe("http://localhost:4244")
        expect(urls.beadsWs).toBe("ws://localhost:4243/ws")
        expect(urls.agentWs).toBe("ws://localhost:4244/ws")
      })

      it("strips trailing slashes from server URLs", () => {
        import.meta.env.VITE_BEADS_SERVER_URL = "http://localhost:4243/"
        import.meta.env.VITE_AGENT_SERVER_URL = "http://localhost:4244/"
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("http://localhost:4243")
        expect(urls.agentHttp).toBe("http://localhost:4244")
      })

      it("converts https to wss for WebSocket URLs", () => {
        import.meta.env.VITE_BEADS_SERVER_URL = "https://beads.example.com"
        import.meta.env.VITE_AGENT_SERVER_URL = "https://agent.example.com"
        const urls = getServerUrls()
        expect(urls.beadsWs).toBe("wss://beads.example.com/ws")
        expect(urls.agentWs).toBe("wss://agent.example.com/ws")
      })

      it("handles only VITE_BEADS_SERVER_URL being set", () => {
        import.meta.env.VITE_BEADS_SERVER_URL = "http://localhost:4243"
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("http://localhost:4243")
        expect(urls.agentHttp).toBe("")
        expect(urls.beadsWs).toBe("ws://localhost:4243/ws")
        // Falls back to buildWsUrl for agentWs when agentBase is empty
        expect(urls.agentWs).toBe("ws://localhost:5173/ws")
      })

      it("handles only VITE_AGENT_SERVER_URL being set", () => {
        import.meta.env.VITE_AGENT_SERVER_URL = "http://localhost:4244"
        const urls = getServerUrls()
        expect(urls.beadsHttp).toBe("")
        expect(urls.agentHttp).toBe("http://localhost:4244")
        // beadsWs is null when beadsBase is empty (no ws base to build from)
        expect(urls.beadsWs).toBeNull()
        expect(urls.agentWs).toBe("ws://localhost:4244/ws")
      })
    })
  })

  describe("isBeadsApiPath", () => {
    let isBeadsApiPath: typeof import(".././serverConfig").isBeadsApiPath

    beforeEach(async () => {
      const mod = await import(".././serverConfig")
      isBeadsApiPath = mod.isBeadsApiPath
    })

    it("returns true for /api/tasks paths", () => {
      expect(isBeadsApiPath("/api/tasks")).toBe(true)
      expect(isBeadsApiPath("/api/tasks/123")).toBe(true)
      expect(isBeadsApiPath("/api/tasks/123/labels")).toBe(true)
    })

    it("returns true for /api/labels paths", () => {
      expect(isBeadsApiPath("/api/labels")).toBe(true)
      expect(isBeadsApiPath("/api/labels/456")).toBe(true)
    })

    it("returns true for /api/workspace paths", () => {
      expect(isBeadsApiPath("/api/workspace")).toBe(true)
      expect(isBeadsApiPath("/api/workspace/info")).toBe(true)
    })

    it("returns false for agent API paths", () => {
      expect(isBeadsApiPath("/api/ralph")).toBe(false)
      expect(isBeadsApiPath("/api/task-chat")).toBe(false)
      expect(isBeadsApiPath("/api/instances")).toBe(false)
      expect(isBeadsApiPath("/api/start")).toBe(false)
      expect(isBeadsApiPath("/api/stop")).toBe(false)
    })

    it("returns false for unknown paths", () => {
      expect(isBeadsApiPath("/api/unknown")).toBe(false)
      expect(isBeadsApiPath("/other/path")).toBe(false)
      expect(isBeadsApiPath("")).toBe(false)
    })
  })

  describe("isAgentApiPath", () => {
    let isAgentApiPath: typeof import(".././serverConfig").isAgentApiPath

    beforeEach(async () => {
      const mod = await import(".././serverConfig")
      isAgentApiPath = mod.isAgentApiPath
    })

    it("returns true for /api/ralph paths", () => {
      expect(isAgentApiPath("/api/ralph")).toBe(true)
      expect(isAgentApiPath("/api/ralph/something")).toBe(true)
    })

    it("returns true for /api/task-chat paths", () => {
      expect(isAgentApiPath("/api/task-chat")).toBe(true)
      expect(isAgentApiPath("/api/task-chat/123")).toBe(true)
    })

    it("returns true for /api/instances paths", () => {
      expect(isAgentApiPath("/api/instances")).toBe(true)
      expect(isAgentApiPath("/api/instances/abc")).toBe(true)
    })

    it("returns true for agent control paths", () => {
      expect(isAgentApiPath("/api/start")).toBe(true)
      expect(isAgentApiPath("/api/stop")).toBe(true)
      expect(isAgentApiPath("/api/pause")).toBe(true)
      expect(isAgentApiPath("/api/resume")).toBe(true)
      expect(isAgentApiPath("/api/status")).toBe(true)
      expect(isAgentApiPath("/api/message")).toBe(true)
    })

    it("returns true for stop-after-current and cancel-stop-after-current", () => {
      expect(isAgentApiPath("/api/stop-after-current")).toBe(true)
      expect(isAgentApiPath("/api/cancel-stop-after-current")).toBe(true)
    })

    it("returns true for /api/state/export paths", () => {
      expect(isAgentApiPath("/api/state/export")).toBe(true)
    })

    it("returns false for beads API paths", () => {
      expect(isAgentApiPath("/api/tasks")).toBe(false)
      expect(isAgentApiPath("/api/labels")).toBe(false)
      expect(isAgentApiPath("/api/workspace")).toBe(false)
    })

    it("returns false for unknown paths", () => {
      expect(isAgentApiPath("/api/unknown")).toBe(false)
      expect(isAgentApiPath("/other/path")).toBe(false)
      expect(isAgentApiPath("")).toBe(false)
    })
  })

  describe("buildServerUrl", () => {
    let buildServerUrl: typeof import(".././serverConfig").buildServerUrl

    beforeEach(async () => {
      const mod = await import(".././serverConfig")
      buildServerUrl = mod.buildServerUrl
    })

    describe("combined mode", () => {
      it("returns the path as-is for beads paths (empty base URL)", () => {
        expect(buildServerUrl("/api/tasks")).toBe("/api/tasks")
        expect(buildServerUrl("/api/labels/1")).toBe("/api/labels/1")
        expect(buildServerUrl("/api/workspace")).toBe("/api/workspace")
      })

      it("returns the path as-is for agent paths (empty base URL)", () => {
        expect(buildServerUrl("/api/ralph")).toBe("/api/ralph")
        expect(buildServerUrl("/api/start")).toBe("/api/start")
      })

      it("returns the path as-is for unknown paths (defaults to agent)", () => {
        expect(buildServerUrl("/api/unknown")).toBe("/api/unknown")
      })
    })

    describe("split mode via explicit URLs", () => {
      beforeEach(() => {
        import.meta.env.VITE_BEADS_SERVER_URL = "http://localhost:4243"
        import.meta.env.VITE_AGENT_SERVER_URL = "http://localhost:4244"
      })

      it("routes beads paths to beads-server URL", () => {
        expect(buildServerUrl("/api/tasks")).toBe("http://localhost:4243/api/tasks")
        expect(buildServerUrl("/api/labels")).toBe("http://localhost:4243/api/labels")
        expect(buildServerUrl("/api/workspace")).toBe("http://localhost:4243/api/workspace")
      })

      it("routes agent paths to agent-server URL", () => {
        expect(buildServerUrl("/api/ralph")).toBe("http://localhost:4244/api/ralph")
        expect(buildServerUrl("/api/start")).toBe("http://localhost:4244/api/start")
        expect(buildServerUrl("/api/task-chat/1")).toBe("http://localhost:4244/api/task-chat/1")
      })

      it("routes unknown paths to agent-server by default", () => {
        expect(buildServerUrl("/api/something-else")).toBe(
          "http://localhost:4244/api/something-else",
        )
      })
    })
  })
})
