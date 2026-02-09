import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { ToolUseCard } from "../ToolUseCard"
import type { ToolUseEvent } from "../../types"

describe("ToolUseCard hover behavior", () => {
  const toolOutput = { isVisible: true, onToggle: vi.fn() }

  const bashEvent: ToolUseEvent = {
    type: "tool_use",
    tool: "Bash",
    input: { command: "ls -la" },
    output: "file1.txt",
    status: "success",
  }

  it("hides the expand/collapse indicator by default and shows it on hover", () => {
    render(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    // The toggle indicator (▼ or ▶︎) should exist but have opacity-0 by default
    const toggleButton = screen.getByLabelText("Toggle Bash output")
    const indicator = toggleButton.querySelector("[data-testid='toggle-indicator']")

    expect(indicator).toBeInTheDocument()
    expect(indicator?.className).toContain("opacity-0")
    expect(indicator?.className).toContain("group-hover/tool:opacity-100")
  })

  it("does not render a toggle indicator when there is no expandable content", () => {
    const noOutputEvent: ToolUseEvent = {
      type: "tool_use",
      tool: "Bash",
      input: { command: "ls" },
      status: "running",
    }

    render(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={noOutputEvent} />
      </AgentViewProvider>,
    )

    const indicator = document.querySelector("[data-testid='toggle-indicator']")
    expect(indicator).not.toBeInTheDocument()
  })
})
