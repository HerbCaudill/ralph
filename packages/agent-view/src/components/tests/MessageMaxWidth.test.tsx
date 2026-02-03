import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { AssistantText } from "../AssistantText"
import { ToolUseCard } from "../ToolUseCard"
import { ThinkingBlock } from "../ThinkingBlock"
import { AgentViewContext, DEFAULT_AGENT_VIEW_CONTEXT } from "../../context/AgentViewContext"

/**
 * Tests to verify message blocks have max-width for improved readability.
 * On wide screens, text that stretches too far becomes hard to read.
 */
describe("Message max-width for readability", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AgentViewContext.Provider value={DEFAULT_AGENT_VIEW_CONTEXT}>
      {children}
    </AgentViewContext.Provider>
  )

  describe("AssistantText", () => {
    it("has max-width constraint for readability", () => {
      const { container } = render(
        <AssistantText
          event={{
            type: "text",
            timestamp: Date.now(),
            content: "Hello world",
          }}
        />,
        { wrapper },
      )

      const outerDiv = container.firstChild as HTMLElement
      expect(outerDiv.className).toContain("max-w-[100ch]")
    })
  })

  describe("ToolUseCard", () => {
    it("has max-width constraint for readability", () => {
      const { container } = render(
        <ToolUseCard
          event={{
            type: "tool_use",
            timestamp: Date.now(),
            tool: "Bash",
            input: { command: "ls" },
            status: "success",
          }}
        />,
        { wrapper },
      )

      const outerDiv = container.firstChild as HTMLElement
      expect(outerDiv.className).toContain("max-w-[100ch]")
    })
  })

  describe("ThinkingBlock", () => {
    it("has max-width constraint for readability", () => {
      const { container } = render(<ThinkingBlock content="Thinking about the problem..." />, {
        wrapper,
      })

      const outerDiv = container.firstChild as HTMLElement
      expect(outerDiv.className).toContain("max-w-[100ch]")
    })
  })
})
