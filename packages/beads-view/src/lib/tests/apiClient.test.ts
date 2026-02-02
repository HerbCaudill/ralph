import { describe, it, expect, vi, beforeEach } from "vitest"
import { configureApiClient, getApiClientConfig, buildApiUrl, apiFetch } from ".././apiClient"

describe("apiClient", () => {
  beforeEach(() => {
    // Reset to default (empty) config before each test
    configureApiClient({})
  })

  describe("configureApiClient", () => {
    it("sets the base URL", () => {
      configureApiClient({ baseUrl: "http://localhost:3000" })
      expect(getApiClientConfig().baseUrl).toBe("http://localhost:3000")
    })

    it("sets a custom fetch function", () => {
      const customFetch = vi.fn()
      configureApiClient({ fetchFn: customFetch as unknown as typeof fetch })
      expect(getApiClientConfig().fetchFn).toBe(customFetch)
    })

    it("replaces previous configuration entirely", () => {
      configureApiClient({ baseUrl: "http://first.com" })
      configureApiClient({ baseUrl: "http://second.com" })
      expect(getApiClientConfig().baseUrl).toBe("http://second.com")
    })

    it("clears previous fields when reconfigured without them", () => {
      configureApiClient({ baseUrl: "http://example.com" })
      configureApiClient({})
      expect(getApiClientConfig().baseUrl).toBeUndefined()
    })
  })

  describe("getApiClientConfig", () => {
    it("returns empty config by default", () => {
      const config = getApiClientConfig()
      expect(config.baseUrl).toBeUndefined()
      expect(config.fetchFn).toBeUndefined()
    })

    it("returns current config after configuration", () => {
      configureApiClient({ baseUrl: "http://localhost:4000" })
      const config = getApiClientConfig()
      expect(config.baseUrl).toBe("http://localhost:4000")
    })
  })

  describe("buildApiUrl", () => {
    it("returns the path as-is when no baseUrl is configured", () => {
      expect(buildApiUrl("/api/tasks")).toBe("/api/tasks")
    })

    it("prepends the baseUrl to the path", () => {
      configureApiClient({ baseUrl: "http://localhost:3000" })
      expect(buildApiUrl("/api/tasks")).toBe("http://localhost:3000/api/tasks")
    })

    it("handles baseUrl without trailing slash", () => {
      configureApiClient({ baseUrl: "http://localhost:3000" })
      expect(buildApiUrl("/api/tasks/123")).toBe("http://localhost:3000/api/tasks/123")
    })

    it("handles empty path", () => {
      configureApiClient({ baseUrl: "http://localhost:3000" })
      expect(buildApiUrl("")).toBe("http://localhost:3000")
    })

    it("concatenates baseUrl and path directly", () => {
      configureApiClient({ baseUrl: "http://localhost:3000" })
      // No slash normalization -- path must include leading slash
      expect(buildApiUrl("api/tasks")).toBe("http://localhost:3000api/tasks")
    })
  })

  describe("apiFetch", () => {
    it("calls custom fetchFn with the built URL", async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 })
      const customFetch = vi.fn().mockResolvedValue(mockResponse)

      configureApiClient({
        baseUrl: "http://localhost:3000",
        fetchFn: customFetch as unknown as typeof fetch,
      })

      const result = await apiFetch("/api/tasks")

      expect(customFetch).toHaveBeenCalledWith("http://localhost:3000/api/tasks", undefined)
      expect(result).toBe(mockResponse)
    })

    it("passes RequestInit options through", async () => {
      const mockResponse = new Response("{}", { status: 201 })
      const customFetch = vi.fn().mockResolvedValue(mockResponse)

      configureApiClient({
        baseUrl: "http://localhost:3000",
        fetchFn: customFetch as unknown as typeof fetch,
      })

      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New task" }),
      }

      await apiFetch("/api/tasks", init)

      expect(customFetch).toHaveBeenCalledWith("http://localhost:3000/api/tasks", init)
    })

    it("uses the path as-is when no baseUrl is configured", async () => {
      const mockResponse = new Response("{}", { status: 200 })
      const customFetch = vi.fn().mockResolvedValue(mockResponse)

      configureApiClient({ fetchFn: customFetch as unknown as typeof fetch })

      await apiFetch("/api/tasks")

      expect(customFetch).toHaveBeenCalledWith("/api/tasks", undefined)
    })

    it("falls back to global fetch when no custom fetchFn is configured", async () => {
      const mockResponse = new Response("{}", { status: 200 })
      const globalFetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse)

      configureApiClient({ baseUrl: "http://localhost:3000" })

      await apiFetch("/api/tasks")

      expect(globalFetchSpy).toHaveBeenCalledWith("http://localhost:3000/api/tasks", undefined)
      globalFetchSpy.mockRestore()
    })
  })
})
