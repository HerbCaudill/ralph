import { describe, it, expect } from "vitest"
import { generateId } from ".././generateId.js"

describe("generateId", () => {
  it("returns a string of length 8", () => {
    expect(generateId()).toHaveLength(8)
  })

  it("returns only hex characters", () => {
    expect(generateId()).toMatch(/^[0-9a-f]{8}$/)
  })

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})
