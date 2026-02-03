import { describe, it, expect } from "vitest"
import { formatModelName } from "../useAdapterVersion"

describe("formatModelName", () => {
  it("returns undefined for undefined input", () => {
    expect(formatModelName(undefined)).toBeUndefined()
  })

  it("formats claude-sonnet-4-20250514 as Sonnet 4", () => {
    expect(formatModelName("claude-sonnet-4-20250514")).toBe("Sonnet 4")
  })

  it("formats claude-opus-4-5-20251101 as Opus 4.5", () => {
    expect(formatModelName("claude-opus-4-5-20251101")).toBe("Opus 4.5")
  })

  it("formats claude-haiku-4-5-20251001 as Haiku 4.5", () => {
    expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5")
  })

  it("returns unknown format strings as-is", () => {
    expect(formatModelName("gpt-4")).toBe("gpt-4")
  })
})
