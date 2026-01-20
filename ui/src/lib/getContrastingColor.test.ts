import { describe, it, expect } from "vitest"
import { getContrastingColor } from "./getContrastingColor"

describe("getContrastingColor", () => {
  it("returns white for dark backgrounds", () => {
    expect(getContrastingColor("#000000")).toBe("#ffffff")
    expect(getContrastingColor("#1a1a1a")).toBe("#ffffff")
    expect(getContrastingColor("#333333")).toBe("#ffffff")
    expect(getContrastingColor("#4d9697")).toBe("#ffffff") // Teal peacock color
  })

  it("returns black for light backgrounds", () => {
    expect(getContrastingColor("#ffffff")).toBe("#000000")
    expect(getContrastingColor("#f0f0f0")).toBe("#000000")
    expect(getContrastingColor("#cccccc")).toBe("#000000")
    expect(getContrastingColor("#ffcc00")).toBe("#000000") // Yellow
  })

  it("handles colors without hash prefix", () => {
    expect(getContrastingColor("000000")).toBe("#ffffff")
    expect(getContrastingColor("ffffff")).toBe("#000000")
  })

  it("handles various accent colors correctly", () => {
    // Blue (VS Code default) - dark enough for white text
    expect(getContrastingColor("#007ACC")).toBe("#ffffff")
    // Green (Vue) - bright enough for white text (luminance ~0.36)
    expect(getContrastingColor("#42B883")).toBe("#ffffff")
    // Purple - dark enough for white text
    expect(getContrastingColor("#9B59B6")).toBe("#ffffff")
    // Orange - light enough for black text
    expect(getContrastingColor("#FFA500")).toBe("#000000")
    // Red - medium, but dark enough for white text
    expect(getContrastingColor("#FF0000")).toBe("#ffffff")
  })
})
