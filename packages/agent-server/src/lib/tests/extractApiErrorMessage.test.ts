import { describe, it, expect } from "vitest"
import { extractApiErrorMessage } from "../extractApiErrorMessage.js"

describe("extractApiErrorMessage", () => {
  it("extracts message from Claude API JSON error format", () => {
    const jsonError = JSON.stringify({
      type: "error",
      error: { type: "api_error", message: "Internal server error" },
      request_id: "req_011Ca5kifC6aGC1CRfMEF1AU",
    })
    expect(extractApiErrorMessage(jsonError)).toBe("Internal server error")
  })

  it("extracts message from Claude API JSON error with nested error object", () => {
    const jsonError = JSON.stringify({
      type: "error",
      error: { type: "rate_limit_error", message: "Rate limit exceeded" },
      request_id: "req_abc123",
    })
    expect(extractApiErrorMessage(jsonError)).toBe("Rate limit exceeded")
  })

  it("returns original message for non-JSON errors", () => {
    expect(extractApiErrorMessage("Connection refused")).toBe("Connection refused")
  })

  it("returns original message for invalid JSON", () => {
    expect(extractApiErrorMessage("{invalid json}")).toBe("{invalid json}")
  })

  it("returns original message when JSON has no error.message field", () => {
    const jsonWithoutMessage = JSON.stringify({ type: "error", error: { type: "unknown" } })
    expect(extractApiErrorMessage(jsonWithoutMessage)).toBe(jsonWithoutMessage)
  })

  it("extracts message from simple error object with message field", () => {
    const jsonError = JSON.stringify({ message: "Simple error message" })
    expect(extractApiErrorMessage(jsonError)).toBe("Simple error message")
  })

  it("handles empty string", () => {
    expect(extractApiErrorMessage("")).toBe("")
  })

  it("handles whitespace-only string", () => {
    expect(extractApiErrorMessage("   ")).toBe("   ")
  })
})
