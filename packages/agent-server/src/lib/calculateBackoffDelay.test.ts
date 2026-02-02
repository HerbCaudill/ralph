import { describe, it, expect } from "vitest"
import { calculateBackoffDelay } from "./calculateBackoffDelay.js"

describe("calculateBackoffDelay", () => {
  const initialDelay = 1000
  const maxDelay = 30000
  const multiplier = 2

  it("returns approximately the initial delay on attempt 0", () => {
    const delay = calculateBackoffDelay(0, initialDelay, maxDelay, multiplier)
    // ±10% jitter means range is [900, 1100]
    expect(delay).toBeGreaterThanOrEqual(900)
    expect(delay).toBeLessThanOrEqual(1100)
  })

  it("increases exponentially with each attempt", () => {
    const delay0 = calculateBackoffDelay(0, initialDelay, maxDelay, multiplier)
    const delay3 = calculateBackoffDelay(3, initialDelay, maxDelay, multiplier)
    // attempt 3 base = 1000 * 2^3 = 8000, should be much larger than attempt 0
    expect(delay3).toBeGreaterThan(delay0 * 2)
  })

  it("clamps at maxDelay", () => {
    // attempt 10 base = 1000 * 2^10 = 1024000, well above maxDelay
    const delay = calculateBackoffDelay(10, initialDelay, maxDelay, multiplier)
    // With 10% jitter on 30000, max is 33000
    expect(delay).toBeLessThanOrEqual(33000)
  })

  it("returns an integer", () => {
    const delay = calculateBackoffDelay(1, 1000, 30000, 2)
    expect(Number.isInteger(delay)).toBe(true)
  })
})
