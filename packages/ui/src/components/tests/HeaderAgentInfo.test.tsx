import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { HeaderAgentInfo } from "../HeaderAgentInfo"

describe("HeaderAgentInfo", () => {
  it("renders agent name and model when both provided", () => {
    render(<HeaderAgentInfo agentDisplayName="Claude" modelName="Sonnet 4" textColor="#ffffff" />)

    expect(screen.getByTestId("header-agent-info")).toBeInTheDocument()
    expect(screen.getByText("Claude")).toBeInTheDocument()
    expect(screen.getByText("(Sonnet 4)")).toBeInTheDocument()
  })

  it("renders only agent name when model is null", () => {
    render(<HeaderAgentInfo agentDisplayName="Claude" modelName={null} textColor="#ffffff" />)

    expect(screen.getByText("Claude")).toBeInTheDocument()
    expect(screen.queryByText("(")).not.toBeInTheDocument()
  })

  it("applies the text color style", () => {
    render(<HeaderAgentInfo agentDisplayName="Claude" modelName="Sonnet 4" textColor="#ff0000" />)

    const container = screen.getByTestId("header-agent-info")
    expect(container).toHaveStyle({ color: "#ff0000" })
  })

  it("renders with correct opacity for muted appearance", () => {
    render(<HeaderAgentInfo agentDisplayName="Codex" modelName="o3" textColor="#000000" />)

    const container = screen.getByTestId("header-agent-info")
    expect(container).toHaveClass("opacity-80")
  })
})
