import { describe, it, expect, beforeEach } from "vitest"
import { getEventHistory, clearEventHistory } from "./index.js"
import type { RalphEvent } from "./RalphManager.js"

// Note: We can't easily test addEventToHistory directly since it's not exported,
// but we can test the public API functions.

describe("eventHistory", () => {
  beforeEach(() => {
    // Clear event history before each test
    clearEventHistory()
  })

  describe("getEventHistory", () => {
    it("returns empty array initially", () => {
      const events = getEventHistory()
      expect(events).toEqual([])
    })
  })

  describe("clearEventHistory", () => {
    it("clears the event history", () => {
      // Get initial state
      const before = getEventHistory()
      expect(before).toEqual([])

      // Clear again (should be idempotent)
      clearEventHistory()

      const after = getEventHistory()
      expect(after).toEqual([])
    })
  })
})
