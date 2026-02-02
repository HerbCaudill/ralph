import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { SettingsMenu } from ".././SettingsMenu"

describe("SettingsMenu", () => {
  describe("rendering", () => {
    it("renders a settings button", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} />)
      expect(screen.getByTitle("Settings")).toBeInTheDocument()
    })

    it("does not show dropdown initially", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} />)
      expect(screen.queryByText("Claude Code")).not.toBeInTheDocument()
    })
  })

  describe("dropdown", () => {
    it("shows agent options when clicked", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} />)
      fireEvent.click(screen.getByTitle("Settings"))
      expect(screen.getByText("Claude Code")).toBeInTheDocument()
      expect(screen.getByText("Codex")).toBeInTheDocument()
    })

    it("shows Agent section header", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} />)
      fireEvent.click(screen.getByTitle("Settings"))
      expect(screen.getByText("Agent")).toBeInTheDocument()
    })

    it("closes dropdown after selecting an agent", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} />)
      fireEvent.click(screen.getByTitle("Settings"))
      fireEvent.click(screen.getByText("Codex"))
      expect(screen.queryByText("Codex")).not.toBeInTheDocument()
    })
  })

  describe("interaction", () => {
    it("calls onAgentTypeChange when selecting a different agent", () => {
      const handleChange = vi.fn()
      render(<SettingsMenu agentType="claude" onAgentTypeChange={handleChange} />)
      fireEvent.click(screen.getByTitle("Settings"))
      fireEvent.click(screen.getByText("Codex"))
      expect(handleChange).toHaveBeenCalledWith("codex")
    })

    it("disables agent options when disabled", () => {
      render(<SettingsMenu agentType="claude" onAgentTypeChange={() => {}} disabled />)
      fireEvent.click(screen.getByTitle("Settings"))
      const codexButton = screen.getByText("Codex").closest("button")
      expect(codexButton).toBeDisabled()
    })
  })
})
