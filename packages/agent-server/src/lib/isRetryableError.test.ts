import { describe, it, expect } from "vitest"
import { isRetryableError } from "./isRetryableError.js"

describe("isRetryableError", () => {
  const retryable = (msg: string) => isRetryableError(new Error(msg))

  describe("connection/network errors", () => {
    it.each([
      "connection error",
      "network error",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "socket hang up",
      "Failed to fetch",
      "getaddrinfo ENOTFOUND api.example.com",
    ])("returns true for '%s'", msg => {
      expect(retryable(msg)).toBe(true)
    })
  })

  describe("rate limit errors", () => {
    it.each(["rate limit exceeded", "rate_limit_error", "HTTP 429 Too Many Requests"])(
      "returns true for '%s'",
      msg => {
        expect(retryable(msg)).toBe(true)
      },
    )
  })

  describe("server errors", () => {
    it.each(["server error", "server_error", "HTTP 500", "502 Bad Gateway", "503", "504"])(
      "returns true for '%s'",
      msg => {
        expect(retryable(msg)).toBe(true)
      },
    )
  })

  it("returns true for overloaded error", () => {
    expect(retryable("API is overloaded")).toBe(true)
  })

  describe("non-retryable errors", () => {
    it.each([
      "invalid API key",
      "permission denied",
      "not found",
      "bad request",
      "validation error",
    ])("returns false for '%s'", msg => {
      expect(retryable(msg)).toBe(false)
    })
  })
})
