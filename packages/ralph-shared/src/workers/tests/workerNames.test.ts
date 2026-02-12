import { describe, it, expect } from "vitest"
import { WORKER_NAMES, getWorkerName, isValidWorkerName, type WorkerName } from "../workerNames.js"

describe("WORKER_NAMES", () => {
  it("should be an array of Simpsons character names", () => {
    expect(WORKER_NAMES).toBeInstanceOf(Array)
    expect(WORKER_NAMES.length).toBeGreaterThan(0)
  })

  it("should include main family members", () => {
    expect(WORKER_NAMES).toContain("homer")
    expect(WORKER_NAMES).toContain("marge")
    expect(WORKER_NAMES).toContain("bart")
    expect(WORKER_NAMES).toContain("lisa")
    expect(WORKER_NAMES).toContain("maggie")
  })

  it("should include extended family and neighbors", () => {
    expect(WORKER_NAMES).toContain("grampa")
    expect(WORKER_NAMES).toContain("ned")
    expect(WORKER_NAMES).toContain("moe")
  })

  it("should be lowercase", () => {
    for (const name of WORKER_NAMES) {
      expect(name).toBe(name.toLowerCase())
    }
  })

  it("should not contain duplicates", () => {
    const unique = new Set(WORKER_NAMES)
    expect(unique.size).toBe(WORKER_NAMES.length)
  })
})

describe("getWorkerName", () => {
  it("should return a valid worker name for index 0", () => {
    const name = getWorkerName(0)
    expect(WORKER_NAMES).toContain(name)
  })

  it("should return different names for different indices", () => {
    const name0 = getWorkerName(0)
    const name1 = getWorkerName(1)
    expect(name0).not.toBe(name1)
  })

  it("should wrap around when index exceeds array length", () => {
    const name = getWorkerName(WORKER_NAMES.length)
    expect(name).toBe(WORKER_NAMES[0])
  })

  it("should handle negative indices by wrapping", () => {
    const name = getWorkerName(-1)
    expect(name).toBe(WORKER_NAMES[WORKER_NAMES.length - 1])
  })
})

describe("isValidWorkerName", () => {
  it("should return true for valid worker names", () => {
    expect(isValidWorkerName("homer")).toBe(true)
    expect(isValidWorkerName("marge")).toBe(true)
    expect(isValidWorkerName("bart")).toBe(true)
  })

  it("should return false for invalid names", () => {
    expect(isValidWorkerName("donald")).toBe(false)
    expect(isValidWorkerName("mickey")).toBe(false)
    expect(isValidWorkerName("")).toBe(false)
  })

  it("should be case-sensitive", () => {
    expect(isValidWorkerName("Homer")).toBe(false)
    expect(isValidWorkerName("HOMER")).toBe(false)
  })
})

describe("WorkerName type", () => {
  it("should work as a type guard", () => {
    const name: string = "homer"
    if (isValidWorkerName(name)) {
      // TypeScript should now know name is WorkerName
      const workerName: WorkerName = name
      expect(workerName).toBe("homer")
    }
  })
})
