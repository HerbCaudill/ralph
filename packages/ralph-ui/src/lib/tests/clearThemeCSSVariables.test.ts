import { describe, expect, it, beforeEach } from "vitest"
import { clearThemeCSSVariables } from "../clearThemeCSSVariables"

describe("clearThemeCSSVariables", () => {
  let element: HTMLDivElement

  beforeEach(() => {
    element = document.createElement("div")
  })

  it("removes all theme CSS variables from the element", () => {
    element.style.setProperty("--background", "#1e1e1e")
    element.style.setProperty("--foreground", "#d4d4d4")
    element.style.setProperty("--primary", "#007acc")
    element.style.setProperty("--sidebar", "#252526")
    element.style.setProperty("--status-success", "#4ade80")

    clearThemeCSSVariables(element)

    expect(element.style.getPropertyValue("--background")).toBe("")
    expect(element.style.getPropertyValue("--foreground")).toBe("")
    expect(element.style.getPropertyValue("--primary")).toBe("")
    expect(element.style.getPropertyValue("--sidebar")).toBe("")
    expect(element.style.getPropertyValue("--status-success")).toBe("")
  })

  it("does not remove non-theme CSS properties", () => {
    element.style.setProperty("--background", "#1e1e1e")
    element.style.setProperty("--custom-var", "hello")
    element.style.setProperty("color", "red")

    clearThemeCSSVariables(element)

    expect(element.style.getPropertyValue("--background")).toBe("")
    expect(element.style.getPropertyValue("--custom-var")).toBe("hello")
    expect(element.style.getPropertyValue("color")).toBe("red")
  })
})
