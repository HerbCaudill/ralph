import { describe, it, expect } from "vitest"
import {
  parseSessionIdFromUrl,
  buildSessionPath,
  parseEventLogHash,
  buildEventLogHash,
} from "./useEventLogRouter"

describe("parseSessionIdFromUrl", () => {
  it("returns null for root path without session", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "" })).toBeNull()
  })

  it("returns null for unrelated paths", () => {
    expect(parseSessionIdFromUrl({ pathname: "/issue/r-abc123", hash: "" })).toBeNull()
    expect(parseSessionIdFromUrl({ pathname: "/something", hash: "" })).toBeNull()
  })

  it("returns ID for valid /session/{id} path format", () => {
    expect(parseSessionIdFromUrl({ pathname: "/session/default-1706123456789", hash: "" })).toBe(
      "default-1706123456789",
    )
    expect(parseSessionIdFromUrl({ pathname: "/session/abc123", hash: "" })).toBe("abc123")
    expect(parseSessionIdFromUrl({ pathname: "/session/session-42", hash: "" })).toBe("session-42")
    expect(parseSessionIdFromUrl({ pathname: "/session/MySession2025", hash: "" })).toBe(
      "MySession2025",
    )
  })

  it("returns ID for legacy #session= hash format (backward compatibility)", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#session=default-123" })).toBe(
      "default-123",
    )
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#session=abc123" })).toBe("abc123")
  })

  it("returns ID for legacy #eventlog= hash format (backward compatibility)", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abcdef12" })).toBe("abcdef12")
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=12345678" })).toBe("12345678")
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=ABCDEF00" })).toBe("ABCDEF00")
  })

  it("returns null for invalid legacy eventlog ID format", () => {
    // Too short
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abc" })).toBeNull()
    // Too long
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abcdef123" })).toBeNull()
    // Invalid characters
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=ghijklmn" })).toBeNull()
  })

  it("prefers path over hash if both present", () => {
    expect(
      parseSessionIdFromUrl({ pathname: "/session/from-path", hash: "#session=from-hash" }),
    ).toBe("from-path")
  })
})

describe("buildSessionPath", () => {
  it("builds a valid path with /session/{id} format", () => {
    expect(buildSessionPath("default-1706123456789")).toBe("/session/default-1706123456789")
    expect(buildSessionPath("abcdef12")).toBe("/session/abcdef12")
  })
})

// Legacy exports for backward compatibility
describe("parseEventLogHash (legacy)", () => {
  it("returns null for empty hash", () => {
    expect(parseEventLogHash("")).toBeNull()
    expect(parseEventLogHash("#")).toBeNull()
  })

  it("returns ID for valid session hash", () => {
    expect(parseEventLogHash("#session=default-123")).toBe("default-123")
  })

  it("returns ID for valid legacy eventlog hash", () => {
    expect(parseEventLogHash("#eventlog=abcdef12")).toBe("abcdef12")
  })
})

describe("buildEventLogHash (legacy)", () => {
  it("builds a valid hash string with session= format", () => {
    expect(buildEventLogHash("default-1706123456789")).toBe("#session=default-1706123456789")
    expect(buildEventLogHash("abcdef12")).toBe("#session=abcdef12")
  })
})
