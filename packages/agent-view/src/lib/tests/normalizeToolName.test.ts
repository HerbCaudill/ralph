import { describe, it, expect } from "vitest"
import { normalizeToolName } from "../normalizeToolName"

describe("normalizeToolName", () => {
  it("should return PascalCase tool name unchanged", () => {
    expect(normalizeToolName("Bash")).toBe("Bash")
    expect(normalizeToolName("Read")).toBe("Read")
    expect(normalizeToolName("Edit")).toBe("Edit")
    expect(normalizeToolName("Write")).toBe("Write")
    expect(normalizeToolName("Grep")).toBe("Grep")
    expect(normalizeToolName("Glob")).toBe("Glob")
    expect(normalizeToolName("WebSearch")).toBe("WebSearch")
    expect(normalizeToolName("WebFetch")).toBe("WebFetch")
    expect(normalizeToolName("TodoWrite")).toBe("TodoWrite")
    expect(normalizeToolName("Task")).toBe("Task")
  })

  it("should normalize lowercase tool names from Codex adapter", () => {
    expect(normalizeToolName("bash")).toBe("Bash")
    expect(normalizeToolName("read")).toBe("Read")
    expect(normalizeToolName("edit")).toBe("Edit")
    expect(normalizeToolName("write")).toBe("Write")
    expect(normalizeToolName("grep")).toBe("Grep")
    expect(normalizeToolName("glob")).toBe("Glob")
    expect(normalizeToolName("websearch")).toBe("WebSearch")
    expect(normalizeToolName("webfetch")).toBe("WebFetch")
    expect(normalizeToolName("todowrite")).toBe("TodoWrite")
    expect(normalizeToolName("task")).toBe("Task")
  })

  it("should normalize uppercase tool names", () => {
    expect(normalizeToolName("BASH")).toBe("Bash")
    expect(normalizeToolName("READ")).toBe("Read")
  })

  it("should return unknown tool names unchanged", () => {
    expect(normalizeToolName("CustomTool")).toBe("CustomTool")
    expect(normalizeToolName("unknowntool")).toBe("unknowntool")
  })
})
