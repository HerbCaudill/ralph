import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { ToolUseCard } from "../ToolUseCard"
import type { ToolUseEvent } from "../../types"

describe(
  "ToolUseCard",
  /** Verify tool cards toggle independently without using the global toggle. */
  () => {
    it(
      "toggles only the clicked card when tool output is visible",
      /** Ensure local toggle does not collapse sibling cards. */
      () => {
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
      },
    )
  },
)
