import { describe, it, expect } from "vitest"
import { cutTaskIdPrefix } from "../cutTaskIdPrefix"

describe("cutTaskIdPrefix", () => {
  it("removes prefix from standard task ID", () => {
    expect(cutTaskIdPrefix("rui-123")).toBe("123")
  })

  it("removes prefix from short prefix ID", () => {
    expect(cutTaskIdPrefix("r-abc12")).toBe("abc12")
  })

  it("returns original if no dash", () => {
    expect(cutTaskIdPrefix("abc123")).toBe("abc123")
  })

  it("handles nested IDs with dots", () => {
    expect(cutTaskIdPrefix("r-oc7b7.14")).toBe("oc7b7.14")
  })

  it("handles empty string", () => {
    expect(cutTaskIdPrefix("")).toBe("")
  })
})
