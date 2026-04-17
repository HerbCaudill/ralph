import { describe, it, expect, vi, afterEach } from "vitest"
import { groupSessionsByRecency } from "../groupSessionsByRecency"

function makeEntry(lastMessageAt: number) {
  return {
    sessionId: `s-${lastMessageAt}`,
    lastMessageAt,
  }
}

/** Helper to get a timestamp for a specific day relative to "now". */
function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

describe("groupSessionsByRecency", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("should return empty array for no sessions", () => {
    expect(groupSessionsByRecency([])).toEqual([])
  })

  it("should group sessions from today under 'Today'", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const sessions = [
      makeEntry(new Date("2025-06-15T13:00:00").getTime()),
      makeEntry(new Date("2025-06-15T09:00:00").getTime()),
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Today")
    expect(groups[0].sessions).toHaveLength(2)
  })

  it("should group sessions from yesterday under 'Yesterday'", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const sessions = [
      makeEntry(new Date("2025-06-14T20:00:00").getTime()),
      makeEntry(new Date("2025-06-14T08:00:00").getTime()),
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Yesterday")
    expect(groups[0].sessions).toHaveLength(2)
  })

  it("should group sessions from the past week under 'Past week'", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00")) // Sunday

    const sessions = [
      makeEntry(new Date("2025-06-12T10:00:00").getTime()), // 3 days ago (Thursday)
      makeEntry(new Date("2025-06-10T10:00:00").getTime()), // 5 days ago (Tuesday)
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Past week")
    expect(groups[0].sessions).toHaveLength(2)
  })

  it("should group sessions older than a week under 'Older'", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const sessions = [
      makeEntry(new Date("2025-06-01T10:00:00").getTime()),
      makeEntry(new Date("2025-05-01T10:00:00").getTime()),
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Older")
    expect(groups[0].sessions).toHaveLength(2)
  })

  it("should create multiple groups when sessions span different time ranges", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const sessions = [
      makeEntry(new Date("2025-06-15T12:00:00").getTime()), // Today
      makeEntry(new Date("2025-06-14T12:00:00").getTime()), // Yesterday
      makeEntry(new Date("2025-06-11T12:00:00").getTime()), // Past week
      makeEntry(new Date("2025-05-01T12:00:00").getTime()), // Older
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(4)
    expect(groups[0].label).toBe("Today")
    expect(groups[0].sessions).toHaveLength(1)
    expect(groups[1].label).toBe("Yesterday")
    expect(groups[1].sessions).toHaveLength(1)
    expect(groups[2].label).toBe("Past week")
    expect(groups[2].sessions).toHaveLength(1)
    expect(groups[3].label).toBe("Older")
    expect(groups[3].sessions).toHaveLength(1)
  })

  it("should omit empty groups", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const sessions = [
      makeEntry(new Date("2025-06-15T12:00:00").getTime()), // Today
      makeEntry(new Date("2025-05-01T12:00:00").getTime()), // Older
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe("Today")
    expect(groups[1].label).toBe("Older")
  })

  it("should preserve order within each group", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T14:00:00"))

    const s1 = makeEntry(new Date("2025-06-15T13:00:00").getTime())
    const s2 = makeEntry(new Date("2025-06-15T10:00:00").getTime())
    const s3 = makeEntry(new Date("2025-06-15T08:00:00").getTime())

    const groups = groupSessionsByRecency([s1, s2, s3])
    expect(groups[0].sessions).toEqual([s1, s2, s3])
  })

  it("should handle midnight boundary correctly", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T00:30:00")) // Just after midnight

    const sessions = [
      makeEntry(new Date("2025-06-15T00:15:00").getTime()), // Today (just after midnight)
      makeEntry(new Date("2025-06-14T23:45:00").getTime()), // Yesterday (just before midnight)
    ]

    const groups = groupSessionsByRecency(sessions)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe("Today")
    expect(groups[0].sessions).toHaveLength(1)
    expect(groups[1].label).toBe("Yesterday")
    expect(groups[1].sessions).toHaveLength(1)
  })
})
