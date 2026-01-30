/**
 * Tests for theme type definitions and default constants.
 */

import { describe, it, expect } from "vitest"
import {
  DEFAULT_STATUS_COLORS,
  DEFAULT_DARK_STATUS_COLORS,
  DEFAULT_LIGHT_STATUS_COLORS,
  type StatusColors,
} from "./types"

describe("DEFAULT_STATUS_COLORS", () => {
  it("should have all required status color keys", () => {
    expect(DEFAULT_STATUS_COLORS).toHaveProperty("success")
    expect(DEFAULT_STATUS_COLORS).toHaveProperty("warning")
    expect(DEFAULT_STATUS_COLORS).toHaveProperty("error")
    expect(DEFAULT_STATUS_COLORS).toHaveProperty("info")
    expect(DEFAULT_STATUS_COLORS).toHaveProperty("neutral")
  })

  it("should have valid hex color values", () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    expect(DEFAULT_STATUS_COLORS.success).toMatch(hexColorRegex)
    expect(DEFAULT_STATUS_COLORS.warning).toMatch(hexColorRegex)
    expect(DEFAULT_STATUS_COLORS.error).toMatch(hexColorRegex)
    expect(DEFAULT_STATUS_COLORS.info).toMatch(hexColorRegex)
    expect(DEFAULT_STATUS_COLORS.neutral).toMatch(hexColorRegex)
  })

  it("should satisfy StatusColors interface", () => {
    const colors: StatusColors = DEFAULT_STATUS_COLORS
    expect(colors).toBeDefined()
  })
})

describe("DEFAULT_DARK_STATUS_COLORS", () => {
  it("should have all required status color keys", () => {
    expect(DEFAULT_DARK_STATUS_COLORS).toHaveProperty("success")
    expect(DEFAULT_DARK_STATUS_COLORS).toHaveProperty("warning")
    expect(DEFAULT_DARK_STATUS_COLORS).toHaveProperty("error")
    expect(DEFAULT_DARK_STATUS_COLORS).toHaveProperty("info")
    expect(DEFAULT_DARK_STATUS_COLORS).toHaveProperty("neutral")
  })

  it("should have valid hex color values", () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    expect(DEFAULT_DARK_STATUS_COLORS.success).toMatch(hexColorRegex)
    expect(DEFAULT_DARK_STATUS_COLORS.warning).toMatch(hexColorRegex)
    expect(DEFAULT_DARK_STATUS_COLORS.error).toMatch(hexColorRegex)
    expect(DEFAULT_DARK_STATUS_COLORS.info).toMatch(hexColorRegex)
    expect(DEFAULT_DARK_STATUS_COLORS.neutral).toMatch(hexColorRegex)
  })

  it("should have brighter colors than default (appropriate for dark themes)", () => {
    // Dark themes use brighter colors for visibility
    // Success green: brighter than default
    expect(parseInt(DEFAULT_DARK_STATUS_COLORS.success.slice(1), 16)).toBeGreaterThan(
      parseInt(DEFAULT_STATUS_COLORS.success.slice(1), 16),
    )
  })

  it("should satisfy StatusColors interface", () => {
    const colors: StatusColors = DEFAULT_DARK_STATUS_COLORS
    expect(colors).toBeDefined()
  })
})

describe("DEFAULT_LIGHT_STATUS_COLORS", () => {
  it("should have all required status color keys", () => {
    expect(DEFAULT_LIGHT_STATUS_COLORS).toHaveProperty("success")
    expect(DEFAULT_LIGHT_STATUS_COLORS).toHaveProperty("warning")
    expect(DEFAULT_LIGHT_STATUS_COLORS).toHaveProperty("error")
    expect(DEFAULT_LIGHT_STATUS_COLORS).toHaveProperty("info")
    expect(DEFAULT_LIGHT_STATUS_COLORS).toHaveProperty("neutral")
  })

  it("should have valid hex color values", () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    expect(DEFAULT_LIGHT_STATUS_COLORS.success).toMatch(hexColorRegex)
    expect(DEFAULT_LIGHT_STATUS_COLORS.warning).toMatch(hexColorRegex)
    expect(DEFAULT_LIGHT_STATUS_COLORS.error).toMatch(hexColorRegex)
    expect(DEFAULT_LIGHT_STATUS_COLORS.info).toMatch(hexColorRegex)
    expect(DEFAULT_LIGHT_STATUS_COLORS.neutral).toMatch(hexColorRegex)
  })

  it("should have darker colors than default (appropriate for light themes)", () => {
    // Light themes use darker colors for visibility
    // Success green: darker than default
    expect(parseInt(DEFAULT_LIGHT_STATUS_COLORS.success.slice(1), 16)).toBeLessThan(
      parseInt(DEFAULT_STATUS_COLORS.success.slice(1), 16),
    )
  })

  it("should satisfy StatusColors interface", () => {
    const colors: StatusColors = DEFAULT_LIGHT_STATUS_COLORS
    expect(colors).toBeDefined()
  })
})
