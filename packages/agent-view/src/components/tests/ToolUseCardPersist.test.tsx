import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { ToolUseCard } from "../ToolUseCard"
import type { ToolUseEvent, AgentViewContextValue } from "../../types"

describe("ToolUseCard expansion persistence", () => {
  it("persists expanded state when component remounts", () => {
    const toolExpansionState = new Map<string, boolean>()
    const setToolExpansionState = (toolUseId: string, expanded: boolean) => {
      toolExpansionState.set(toolUseId, expanded)
    }

    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      toolUseId: "tool-123",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    const toolOutput = { isVisible: true, onToggle: vi.fn() }
    const contextValue: Partial<AgentViewContextValue> = {
      toolOutput,
      toolExpansionState,
      setToolExpansionState,
    }

    // Initial render - should be expanded by default
    const { unmount } = render(
      <AgentViewProvider value={contextValue}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    const bashToggle = screen.getByLabelText("Toggle Bash output")
    expect(bashToggle).toHaveAttribute("aria-expanded", "true")

    // Click to collapse
    fireEvent.click(bashToggle)
    expect(bashToggle).toHaveAttribute("aria-expanded", "false")

    // Unmount and remount (simulating re-render from new events streaming in)
    unmount()

    render(
      <AgentViewProvider value={contextValue}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    // Should still be collapsed after remount
    const bashToggleAfterRemount = screen.getByLabelText("Toggle Bash output")
    expect(bashToggleAfterRemount).toHaveAttribute("aria-expanded", "false")
  })

  it("tracks expansion state independently for different tool uses", () => {
    const toolExpansionState = new Map<string, boolean>()
    const setToolExpansionState = (toolUseId: string, expanded: boolean) => {
      toolExpansionState.set(toolUseId, expanded)
    }

    const bashEvent1: ToolUseEvent = {
      type: "tool_use",
      toolUseId: "tool-1",
      tool: "Bash",
      output: "first command",
      status: "success",
    }
    const bashEvent2: ToolUseEvent = {
      type: "tool_use",
      toolUseId: "tool-2",
      tool: "Bash",
      output: "second command",
      status: "success",
    }
    const toolOutput = { isVisible: true, onToggle: vi.fn() }
    const contextValue: Partial<AgentViewContextValue> = {
      toolOutput,
      toolExpansionState,
      setToolExpansionState,
    }

    render(
      <AgentViewProvider value={contextValue}>
        <ToolUseCard event={bashEvent1} />
        <ToolUseCard event={bashEvent2} />
      </AgentViewProvider>,
    )

    const toggles = screen.getAllByLabelText("Toggle Bash output")
    expect(toggles).toHaveLength(2)

    // Both expanded by default
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true")
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true")

    // Collapse only the first one
    fireEvent.click(toggles[0])
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false")
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true")

    // Verify the state map records the toggle action
    // Only tool-1 was explicitly toggled, so only it has recorded state
    expect(toolExpansionState.get("tool-1")).toBe(false)
    // tool-2 was never toggled, so it has no explicit state (uses default)
    expect(toolExpansionState.has("tool-2")).toBe(false)
  })

  it("uses default expanded state when no persisted state exists", () => {
    const toolExpansionState = new Map<string, boolean>()
    const setToolExpansionState = (toolUseId: string, expanded: boolean) => {
      toolExpansionState.set(toolUseId, expanded)
    }

    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      toolUseId: "tool-new",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    const toolOutput = { isVisible: true, onToggle: vi.fn() }
    const contextValue: Partial<AgentViewContextValue> = {
      toolOutput,
      toolExpansionState,
      setToolExpansionState,
    }

    render(
      <AgentViewProvider value={contextValue}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    // Should be expanded by default (matches global isVisible state)
    const bashToggle = screen.getByLabelText("Toggle Bash output")
    expect(bashToggle).toHaveAttribute("aria-expanded", "true")
  })

  it("falls back to local state when toolExpansionState is not provided in context", () => {
    // This test ensures backward compatibility
    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      toolUseId: "tool-123",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    const toolOutput = { isVisible: true, onToggle: vi.fn() }

    render(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    const bashToggle = screen.getByLabelText("Toggle Bash output")
    expect(bashToggle).toHaveAttribute("aria-expanded", "true")

    // Click to collapse - should still work with local state
    fireEvent.click(bashToggle)
    expect(bashToggle).toHaveAttribute("aria-expanded", "false")
  })
})
