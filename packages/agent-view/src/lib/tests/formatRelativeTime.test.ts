import { describe, it, expect } from "vitest"
import { formatRelativeTime } from "../formatRelativeTime"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe("formatRelativeTime", () => {
  const now = 1_700_000_000_000

  describe("just now", () => {
    it("should return 'just now' for 0ms difference", () => {
      expect(formatRelativeTime(now, now)).toBe("just now")
    })

    it("should return 'just now' for less than 60 seconds", () => {
      expect(formatRelativeTime(now - 30 * SECOND, now)).toBe("just now")
    })

    it("should return 'just now' for exactly 59 seconds", () => {
      expect(formatRelativeTime(now - 59 * SECOND, now)).toBe("just now")
    })

    it("should return 'just now' for future timestamps", () => {
      expect(formatRelativeTime(now + 10 * MINUTE, now)).toBe("just now")
    })
  })

  describe("minutes", () => {
    it("should return '1 minute ago' for exactly 60 seconds", () => {
      expect(formatRelativeTime(now - 60 * SECOND, now)).toBe("1 minute ago")
    })

    it("should return '1 minute ago' for 90 seconds", () => {
      expect(formatRelativeTime(now - 90 * SECOND, now)).toBe("1 minute ago")
    })

    it("should return '2 minutes ago' for 2 minutes", () => {
      expect(formatRelativeTime(now - 2 * MINUTE, now)).toBe("2 minutes ago")
    })

    it("should return '59 minutes ago' for 59 minutes", () => {
      expect(formatRelativeTime(now - 59 * MINUTE, now)).toBe("59 minutes ago")
    })
  })

  describe("hours", () => {
    it("should return '1 hour ago' for exactly 60 minutes", () => {
      expect(formatRelativeTime(now - 60 * MINUTE, now)).toBe("1 hour ago")
    })

    it("should return '1 hour ago' for 90 minutes", () => {
      expect(formatRelativeTime(now - 90 * MINUTE, now)).toBe("1 hour ago")
    })

    it("should return '2 hours ago' for 2 hours", () => {
      expect(formatRelativeTime(now - 2 * HOUR, now)).toBe("2 hours ago")
    })

    it("should return '23 hours ago' for 23 hours", () => {
      expect(formatRelativeTime(now - 23 * HOUR, now)).toBe("23 hours ago")
    })
  })

  describe("days", () => {
    it("should return '1 day ago' for exactly 24 hours", () => {
      expect(formatRelativeTime(now - 24 * HOUR, now)).toBe("1 day ago")
    })

    it("should return '2 days ago' for 2 days", () => {
      expect(formatRelativeTime(now - 2 * DAY, now)).toBe("2 days ago")
    })

    it("should return '29 days ago' for 29 days", () => {
      expect(formatRelativeTime(now - 29 * DAY, now)).toBe("29 days ago")
    })
  })

  describe("months", () => {
    it("should return '1 month ago' for 30 days", () => {
      expect(formatRelativeTime(now - 30 * DAY, now)).toBe("1 month ago")
    })

    it("should return '2 months ago' for 60 days", () => {
      expect(formatRelativeTime(now - 60 * DAY, now)).toBe("2 months ago")
    })

    it("should return '11 months ago' for 11 months", () => {
      expect(formatRelativeTime(now - 330 * DAY, now)).toBe("11 months ago")
    })
  })

  describe("years", () => {
    it("should return '1 year ago' for 12 months", () => {
      expect(formatRelativeTime(now - 365 * DAY, now)).toBe("1 year ago")
    })

    it("should return '2 years ago' for 2 years", () => {
      expect(formatRelativeTime(now - 730 * DAY, now)).toBe("2 years ago")
    })

    it("should return '5 years ago' for 5 years", () => {
      expect(formatRelativeTime(now - 5 * 365 * DAY, now)).toBe("5 years ago")
    })
  })

  describe("default now parameter", () => {
    it("should use Date.now() when now is not provided", () => {
      const recent = Date.now() - 5 * MINUTE
      expect(formatRelativeTime(recent)).toBe("5 minutes ago")
    })
  })
})
