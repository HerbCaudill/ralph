import { describe, it, expect } from "vitest"
import {
  getControlBarButtonStates,
  controlStateToRalphStatus,
  type RalphStatus,
} from "../getControlBarButtonStates"

describe("getControlBarButtonStates", () => {
  describe("when disconnected", () => {
    it("disables all buttons regardless of status", () => {
      const statuses: RalphStatus[] = [
        "stopped",
        "starting",
        "running",
        "pausing",
        "paused",
        "stopping",
        "stopping_after_current",
      ]

      for (const status of statuses) {
        const result = getControlBarButtonStates(status, false)
        expect(result).toEqual({
          start: false,
          pause: false,
          stop: false,
          stopAfterCurrent: false,
        })
      }
    })
  })

  describe("when connected", () => {
    it("returns correct states for stopped", () => {
      const result = getControlBarButtonStates("stopped", true)
      expect(result).toEqual({
        start: true,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      })
    })

    it("returns correct states for starting", () => {
      const result = getControlBarButtonStates("starting", true)
      expect(result).toEqual({
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      })
    })

    it("returns correct states for running", () => {
      const result = getControlBarButtonStates("running", true)
      expect(result).toEqual({
        start: false,
        pause: true,
        stop: true,
        stopAfterCurrent: true,
      })
    })

    it("returns correct states for pausing", () => {
      const result = getControlBarButtonStates("pausing", true)
      expect(result).toEqual({
        start: false,
        pause: false,
        stop: true,
        stopAfterCurrent: true,
      })
    })

    it("returns correct states for paused", () => {
      const result = getControlBarButtonStates("paused", true)
      expect(result).toEqual({
        start: false,
        pause: true,
        stop: true,
        stopAfterCurrent: true,
      })
    })

    it("returns correct states for stopping", () => {
      const result = getControlBarButtonStates("stopping", true)
      expect(result).toEqual({
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      })
    })

    it("returns correct states for stopping_after_current", () => {
      const result = getControlBarButtonStates("stopping_after_current", true)
      expect(result).toEqual({
        start: false,
        pause: false,
        stop: true,
        stopAfterCurrent: true,
      })
    })
  })
})

describe("controlStateToRalphStatus", () => {
  it("maps idle to stopped", () => {
    expect(controlStateToRalphStatus("idle")).toBe("stopped")
  })

  it("maps running to running", () => {
    expect(controlStateToRalphStatus("running")).toBe("running")
  })

  it("maps paused to paused", () => {
    expect(controlStateToRalphStatus("paused")).toBe("paused")
  })

  it("returns stopping_after_current when flag is set", () => {
    expect(controlStateToRalphStatus("running", true)).toBe("stopping_after_current")
    expect(controlStateToRalphStatus("idle", true)).toBe("stopping_after_current")
    expect(controlStateToRalphStatus("paused", true)).toBe("stopping_after_current")
  })
})
