import { describe, expect, it, beforeEach } from "vitest"
import { applyThemeCSSVariables } from "../applyThemeCSSVariables"
import type { CSSVariables } from "@herbcaudill/agent-view-theme"

describe("applyThemeCSSVariables", () => {
  let element: HTMLDivElement

  beforeEach(() => {
    element = document.createElement("div")
  })

  it("sets CSS custom properties on the element", () => {
    const cssVariables = {
      "--background": "#1e1e1e",
      "--foreground": "#d4d4d4",
    } as CSSVariables

    applyThemeCSSVariables(element, cssVariables)

    expect(element.style.getPropertyValue("--background")).toBe("#1e1e1e")
    expect(element.style.getPropertyValue("--foreground")).toBe("#d4d4d4")
  })

  it("overwrites existing CSS custom properties", () => {
    element.style.setProperty("--background", "#ffffff")

    const cssVariables = {
      "--background": "#1e1e1e",
    } as CSSVariables

    applyThemeCSSVariables(element, cssVariables)

    expect(element.style.getPropertyValue("--background")).toBe("#1e1e1e")
  })
})
