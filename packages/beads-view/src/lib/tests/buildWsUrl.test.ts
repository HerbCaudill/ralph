import { describe, it, expect } from "vitest"
import { buildWsUrl } from "../buildWsUrl"

describe("buildWsUrl", () => {
  describe("protocol conversion", () => {
    it("converts http:// to ws://", () => {
      expect(buildWsUrl("http://localhost:3000")).toBe("ws://localhost:3000")
    })

    it("converts https:// to wss://", () => {
      expect(buildWsUrl("https://example.com")).toBe("wss://example.com")
    })

    it("preserves port numbers", () => {
      expect(buildWsUrl("http://localhost:4244")).toBe("ws://localhost:4244")
      expect(buildWsUrl("https://example.com:8443")).toBe("wss://example.com:8443")
    })

    it("preserves paths", () => {
      expect(buildWsUrl("http://localhost:3000/api")).toBe("ws://localhost:3000/api")
      expect(buildWsUrl("https://example.com/api/v1")).toBe("wss://example.com/api/v1")
    })
  })

  describe("relative URLs", () => {
    it("returns /ws path for empty baseUrl", () => {
      expect(buildWsUrl("")).toBe("/ws")
    })

    it("returns /ws path for undefined baseUrl", () => {
      expect(buildWsUrl(undefined)).toBe("/ws")
    })

    it("handles relative paths starting with /", () => {
      expect(buildWsUrl("/api")).toBe("/ws")
    })

    it("handles relative paths without leading slash", () => {
      expect(buildWsUrl("api")).toBe("/ws")
    })
  })

  describe("with path suffix", () => {
    it("appends path suffix to absolute URL", () => {
      expect(buildWsUrl("http://localhost:3000", "/events")).toBe(
        "ws://localhost:3000/events",
      )
    })

    it("appends path suffix to https URL", () => {
      expect(buildWsUrl("https://example.com", "/stream")).toBe(
        "wss://example.com/stream",
      )
    })

    it("uses path suffix for relative URLs", () => {
      expect(buildWsUrl("", "/events")).toBe("/events")
      expect(buildWsUrl(undefined, "/stream")).toBe("/stream")
    })

    it("normalizes path suffix without leading slash", () => {
      expect(buildWsUrl("http://localhost:3000", "events")).toBe(
        "ws://localhost:3000/events",
      )
    })
  })

  describe("edge cases", () => {
    it("handles baseUrl with trailing slash", () => {
      expect(buildWsUrl("http://localhost:3000/")).toBe("ws://localhost:3000/")
    })

    it("handles uppercase protocol", () => {
      expect(buildWsUrl("HTTP://localhost:3000")).toBe("ws://localhost:3000")
      expect(buildWsUrl("HTTPS://example.com")).toBe("wss://example.com")
    })

    it("preserves query parameters", () => {
      expect(buildWsUrl("http://localhost:3000?foo=bar")).toBe("ws://localhost:3000?foo=bar")
    })

    it("handles complex URLs with path, query, and fragment", () => {
      expect(buildWsUrl("http://localhost:3000/api?foo=bar#section")).toBe(
        "ws://localhost:3000/api?foo=bar#section",
      )
    })
  })
})
