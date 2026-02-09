import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { ToolUseCard } from "../ToolUseCard"
import type { ToolUseEvent } from "../../types"

describe("ToolUseCard" /** Verify tool cards toggle independently without using the global toggle. */, () => {
  it("toggles only the clicked card when tool output is visible" /** Ensure local toggle does not collapse sibling cards. */, () => {
    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    const readEvent: ToolUseEvent = {
      type: "tool_use",
      tool: "Read",
      output: "file contents",
      status: "success",
    }
    const toolOutput = { isVisible: true, onToggle: vi.fn() }

    render(
      <AgentViewProvider value={{ toolOutput }}>
        <div>
          <ToolUseCard event={bashEvent} />
          <ToolUseCard event={readEvent} />
        </div>
      </AgentViewProvider>,
    )

    const bashToggle = screen.getByLabelText("Toggle Bash output")
    const readToggle = screen.getByLabelText("Toggle Read output")

    expect(bashToggle).toHaveAttribute("aria-expanded", "true")
    expect(readToggle).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(bashToggle)

    expect(bashToggle).toHaveAttribute("aria-expanded", "false")
    expect(readToggle).toHaveAttribute("aria-expanded", "true")
  })

  it("allows individual expand when global state is collapsed" /** Bug: individual toggles should work regardless of global state. */, () => {
    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    const toolOutput = { isVisible: false, onToggle: vi.fn() }

    render(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    const bashToggle = screen.getByLabelText("Toggle Bash output")

    // Initially collapsed because global state is false
    expect(bashToggle).toHaveAttribute("aria-expanded", "false")

    // Individual click should expand it
    fireEvent.click(bashToggle)

    expect(bashToggle).toHaveAttribute("aria-expanded", "true")
  })

  it("syncs local state when global state changes" /** Global toggle should reset all cards. */, () => {
    const bashEvent: ToolUseEvent = {
      type: "tool_use",
      tool: "Bash",
      output: "echo ok",
      status: "success",
    }
    let isVisible = true
    const toolOutput = {
      get isVisible() {
        return isVisible
      },
      onToggle: vi.fn(),
    }

    const { rerender } = render(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    const bashToggle = screen.getByLabelText("Toggle Bash output")

    // Initially expanded
    expect(bashToggle).toHaveAttribute("aria-expanded", "true")

    // Manually collapse via individual toggle
    fireEvent.click(bashToggle)
    expect(bashToggle).toHaveAttribute("aria-expanded", "false")

    // Simulate global toggle to collapse all
    isVisible = false
    rerender(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    // Should now be collapsed (synced with global)
    expect(bashToggle).toHaveAttribute("aria-expanded", "false")

    // Simulate global toggle to expand all
    isVisible = true
    rerender(
      <AgentViewProvider value={{ toolOutput }}>
        <ToolUseCard event={bashEvent} />
      </AgentViewProvider>,
    )

    // Should now be expanded (synced with global)
    expect(bashToggle).toHaveAttribute("aria-expanded", "true")
  })
})
