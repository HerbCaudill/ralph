import { describe, it, expect } from "vitest"
import { stripTaskPrefix } from "./stripTaskPrefix"

describe("stripTaskPrefix", () => {
  it("strips the prefix from a simple task ID", () => {
    expect(stripTaskPrefix("rui-4vp", "rui")).toBe("4vp")
  })

  it("strips the prefix from a task ID with decimal suffix", () => {
    expect(stripTaskPrefix("rui-4vp.5", "rui")).toBe("4vp.5")
  })

  it("returns the full ID if prefix is null", () => {
    expect(stripTaskPrefix("rui-4vp", null)).toBe("rui-4vp")
  })

  it("returns the full ID if prefix does not match", () => {
    expect(stripTaskPrefix("foo-4vp", "rui")).toBe("foo-4vp")
  })

  it("handles prefixes with special regex characters", () => {
    // Although unlikely, prefix might contain special chars
    expect(stripTaskPrefix("a.b-123", "a.b")).toBe("123")
  })

  it("handles empty string task ID", () => {
    expect(stripTaskPrefix("", "rui")).toBe("")
  })

  it("handles task ID that exactly matches prefix-", () => {
    // Edge case: prefix- with nothing after
    expect(stripTaskPrefix("rui-", "rui")).toBe("")
  })

  it("handles different prefix lengths", () => {
    expect(stripTaskPrefix("proj-abc123", "proj")).toBe("abc123")
    expect(stripTaskPrefix("x-1", "x")).toBe("1")
    expect(stripTaskPrefix("longprefix-abc", "longprefix")).toBe("abc")
  })

  it("is case-sensitive", () => {
    // Task IDs are lowercase, so uppercase prefix shouldn't match
    expect(stripTaskPrefix("rui-4vp", "RUI")).toBe("rui-4vp")
  })
})
