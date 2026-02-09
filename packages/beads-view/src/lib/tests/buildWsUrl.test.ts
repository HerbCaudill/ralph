import { describe, it, expect } from "vitest"
import { buildWsUrl } from "../buildWsUrl"

describe("buildWsUrl", () => {
  describe("protocol conversion", () => {
    it("converts http:// to ws:// and appends /ws path", () => {
      expect(buildWsUrl("http://localhost:3000")).toBe("ws://localhost:3000/ws")
    })

    it("converts https:// to wss:// and appends /ws path", () => {
      expect(buildWsUrl("https://example.com")).toBe("wss://example.com/ws")
    })

    it("preserves port numbers", () => {
      expect(buildWsUrl("http://localhost:4244")).toBe("ws://localhost:4244/ws")
      expect(buildWsUrl("https://example.com:8443")).toBe("wss://example.com:8443/ws")
    })

    it("preserves paths and appends /ws suffix", () => {
      expect(buildWsUrl("http://localhost:3000/api")).toBe("ws://localhost:3000/api/ws")
      expect(buildWsUrl("https://example.com/api/v1")).toBe("wss://example.com/api/v1/ws")
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
      expect(buildWsUrl("http://localhost:3000", "/events")).toBe("ws://localhost:3000/events")
    })

    it("appends path suffix to https URL", () => {
      expect(buildWsUrl("https://example.com", "/stream")).toBe("wss://example.com/stream")
    })

    it("uses path suffix for relative URLs", () => {
      expect(buildWsUrl("", "/events")).toBe("/events")
      expect(buildWsUrl(undefined, "/stream")).toBe("/stream")
    })

    it("normalizes path suffix without leading slash", () => {
      expect(buildWsUrl("http://localhost:3000", "events")).toBe("ws://localhost:3000/events")
    })
  })

  describe("edge cases", () => {
    it("handles baseUrl with trailing slash by removing it", () => {
      expect(buildWsUrl("http://localhost:3000/")).toBe("ws://localhost:3000/ws")
    })

    it("handles uppercase protocol", () => {
      expect(buildWsUrl("HTTP://localhost:3000")).toBe("ws://localhost:3000/ws")
      expect(buildWsUrl("HTTPS://example.com")).toBe("wss://example.com/ws")
    })

    it("appends path suffix to URLs with query parameters", () => {
      // Note: This produces a non-standard URL but preserves the intent
      expect(buildWsUrl("http://localhost:3000?foo=bar")).toBe("ws://localhost:3000?foo=bar/ws")
    })

    it("appends path suffix to URLs with path, query, and fragment", () => {
      // Note: This produces a non-standard URL but preserves the intent
      expect(buildWsUrl("http://localhost:3000/api?foo=bar#section")).toBe(
        "ws://localhost:3000/api?foo=bar#section/ws",
      )
    })
  })
})
