import { describe, it, expect } from "vitest"
import { parsePromiseCompleteEvent } from ".././parsePromiseCompleteEvent"

describe("parsePromiseCompleteEvent", () => {
  const timestamp = 1234567890

  it("should parse promise complete tag", () => {
    const text = "<promise>COMPLETE</promise>"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should be case insensitive for tag", () => {
    const text = "<PROMISE>COMPLETE</PROMISE>"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should be case insensitive for content", () => {
    const text = "<promise>complete</promise>"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should match when marker is at the end of text", () => {
    const text = "All done! <promise>COMPLETE</promise>"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should match when marker is at the end of multiline text", () => {
    const text = "Work complete.\n<promise>COMPLETE</promise>"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should match with trailing whitespace after marker", () => {
    const text = "<promise>COMPLETE</promise>  \n"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp,
    })
  })

  it("should NOT match when marker is in the middle of text", () => {
    const text = "All done! <promise>COMPLETE</promise> Goodbye."
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toBeNull()
  })

  it("should NOT match when marker is discussed in code context", () => {
    const text =
      "The worker tracks `sessionCompleted` flag when `<promise>COMPLETE</promise>` is detected"
    const result = parsePromiseCompleteEvent(text, timestamp)

    expect(result).toBeNull()
  })

  describe("invalid patterns", () => {
    it("should return null for plain text", () => {
      const text = "This is just plain text"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for malformed tag", () => {
      const text = "<promise>COMPLETE"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for wrong content", () => {
      const text = "<promise>INCOMPLETE</promise>"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for empty tag", () => {
      const text = "<promise></promise>"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for empty string", () => {
      const result = parsePromiseCompleteEvent("", timestamp)

      expect(result).toBeNull()
    })
  })

  describe("whitespace handling", () => {
    it("should not match with extra spaces", () => {
      const text = "<promise> COMPLETE </promise>"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should not match with newlines", () => {
      const text = "<promise>\nCOMPLETE\n</promise>"
      const result = parsePromiseCompleteEvent(text, timestamp)

      expect(result).toBeNull()
    })
  })
})
