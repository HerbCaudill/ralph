import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { AgentSelector } from "./AgentSelector"

describe("AgentSelector", () => {
  describe("rendering", () => {
    it("renders both agent buttons", () => {
      render(<AgentSelector value="claude" onChange={() => {}} />)
      expect(screen.getByTitle("Claude Code")).toBeInTheDocument()
      expect(screen.getByTitle("Codex")).toBeInTheDocument()
    })

    it("displays button labels", () => {
      render(<AgentSelector value="claude" onChange={() => {}} />)
      expect(screen.getByText("Claude Code")).toBeInTheDocument()
      expect(screen.getByText("Codex")).toBeInTheDocument()
    })
  })

  describe("active state", () => {
    it("highlights Claude Code when value is 'claude'", () => {
      render(<AgentSelector value="claude" onChange={() => {}} />)
      const claudeButton = screen.getByTitle("Claude Code")
      expect(claudeButton).toHaveClass("bg-primary")
    })

    it("highlights Codex when value is 'codex'", () => {
      render(<AgentSelector value="codex" onChange={() => {}} />)
      const codexButton = screen.getByTitle("Codex")
      expect(codexButton).toHaveClass("bg-primary")
    })

    it("does not highlight inactive button", () => {
      render(<AgentSelector value="claude" onChange={() => {}} />)
      const codexButton = screen.getByTitle("Codex")
      expect(codexButton).not.toHaveClass("bg-primary")
    })
  })

  describe("interaction", () => {
    it("calls onChange with 'codex' when Codex button is clicked", () => {
      const handleChange = vi.fn()
      render(<AgentSelector value="claude" onChange={handleChange} />)
      fireEvent.click(screen.getByTitle("Codex"))
      expect(handleChange).toHaveBeenCalledWith("codex")
    })

    it("calls onChange with 'claude' when Claude Code button is clicked", () => {
      const handleChange = vi.fn()
      render(<AgentSelector value="codex" onChange={handleChange} />)
      fireEvent.click(screen.getByTitle("Claude Code"))
      expect(handleChange).toHaveBeenCalledWith("claude")
    })

    it("calls onChange even when clicking the already-active button", () => {
      const handleChange = vi.fn()
      render(<AgentSelector value="claude" onChange={handleChange} />)
      fireEvent.click(screen.getByTitle("Claude Code"))
      expect(handleChange).toHaveBeenCalledWith("claude")
    })
  })

  describe("disabled state", () => {
    it("disables both buttons when disabled prop is true", () => {
      render(<AgentSelector value="claude" onChange={() => {}} disabled />)
      expect(screen.getByTitle("Claude Code")).toBeDisabled()
      expect(screen.getByTitle("Codex")).toBeDisabled()
    })

    it("does not call onChange when disabled", () => {
      const handleChange = vi.fn()
      render(<AgentSelector value="claude" onChange={handleChange} disabled />)
      fireEvent.click(screen.getByTitle("Codex"))
      expect(handleChange).not.toHaveBeenCalled()
    })

    it("applies opacity class when disabled", () => {
      render(<AgentSelector value="claude" onChange={() => {}} disabled />)
      const button = screen.getByTitle("Claude Code")
      expect(button).toHaveClass("disabled:opacity-50")
    })
  })
})
