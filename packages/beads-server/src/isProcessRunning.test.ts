import { describe, it, expect } from "vitest"
import { isProcessRunning } from "./isProcessRunning.js"

describe("isProcessRunning", () => {
  it("returns true for the current process PID", () => {
    expect(isProcessRunning(process.pid)).toBe(true)
  })

  it("returns true for the parent process PID", () => {
    // The parent process (the test runner) should be running
    expect(isProcessRunning(process.ppid)).toBe(true)
  })

  it("returns false for a bogus high PID", () => {
    // PID 999999999 is extremely unlikely to be running
    expect(isProcessRunning(999999999)).toBe(false)
  })

  it("returns false for a negative PID", () => {
    expect(isProcessRunning(-12345)).toBe(false)
  })
})
