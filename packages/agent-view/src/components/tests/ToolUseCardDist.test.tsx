import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentViewProvider, ToolUseCard } from "@herbcaudill/agent-view"
import type { ToolUseChatEvent } from "../../types"

/** Verify package exports render lowercase Codex tool names with command summaries. */
describe("ToolUseCard dist export", () => {
  /** Ensure lowercase bash tool names still show the command summary. */
  it("shows the bash command summary for lowercase tool names", () => {
    const event: ToolUseChatEvent = {
      type: "tool_use",
      timestamp: 100,
      tool: "bash" as ToolUseChatEvent["tool"],
      input: { command: "/bin/zsh -lc 'pnpm test:all'" },
      output: "All tests pass",
      status: "success",
      toolUseId: "item_1",
    }

    render(
      <AgentViewProvider>
        <ToolUseCard event={event} />
      </AgentViewProvider>,
    )

    expect(screen.getByText("/bin/zsh -lc 'pnpm test:all'")).toBeInTheDocument()
  })
})
