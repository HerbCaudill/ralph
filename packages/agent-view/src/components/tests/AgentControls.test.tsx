import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { AgentControls } from "../AgentControls"

describe("AgentControls", () => {
  describe("rendering", () => {
    it("renders new session button by default", () => {
      render(<AgentControls state="idle" />)
      expect(screen.getByTitle("New session")).toBeInTheDocument()
    })

    it("renders pause button when running", () => {
      render(<AgentControls state="running" />)
      expect(screen.getByTitle("Pause")).toBeInTheDocument()
    })

    it("renders resume button when paused", () => {
      render(<AgentControls state="paused" />)
      expect(screen.getByTitle("Resume")).toBeInTheDocument()
    })

    it("renders stop button by default", () => {
      render(<AgentControls state="idle" />)
      expect(screen.getByTitle("Stop")).toBeInTheDocument()
    })

    it("hides new session button when showNewSession is false", () => {
      render(<AgentControls state="idle" showNewSession={false} />)
      expect(screen.queryByTitle("New session")).not.toBeInTheDocument()
    })

    it("hides pause/resume button when showPauseResume is false", () => {
      render(<AgentControls state="running" showPauseResume={false} />)
      expect(screen.queryByTitle("Pause")).not.toBeInTheDocument()
    })

    it("hides stop button when showStop is false", () => {
      render(<AgentControls state="idle" showStop={false} />)
      expect(screen.queryByTitle("Stop")).not.toBeInTheDocument()
    })
  })

  describe("Button component usage", () => {
    it("renders buttons with data-slot='button'", () => {
      render(<AgentControls state="idle" />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("data-slot", "button")
      }
    })

    it("renders buttons with ghost variant", () => {
      render(<AgentControls state="idle" />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("data-variant", "ghost")
      }
    })

    it("uses icon-sm size for md (default) size prop", () => {
      render(<AgentControls state="idle" />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("data-size", "icon-sm")
      }
    })

    it("uses icon-xs size for sm size prop", () => {
      render(<AgentControls state="idle" size="sm" />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("data-size", "icon-xs")
      }
    })

    it("uses icon size for lg size prop", () => {
      render(<AgentControls state="idle" size="lg" />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toHaveAttribute("data-size", "icon")
      }
    })
  })

  describe("disabled states", () => {
    it("disables new session button when running", () => {
      render(<AgentControls state="running" />)
      expect(screen.getByTitle("New session")).toBeDisabled()
    })

    it("enables new session button when idle", () => {
      render(<AgentControls state="idle" />)
      expect(screen.getByTitle("New session")).not.toBeDisabled()
    })

    it("disables pause button when idle", () => {
      render(<AgentControls state="idle" />)
      expect(screen.getByTitle("Pause")).toBeDisabled()
    })

    it("enables pause button when running", () => {
      render(<AgentControls state="running" />)
      expect(screen.getByTitle("Pause")).not.toBeDisabled()
    })

    it("enables resume button when paused", () => {
      render(<AgentControls state="paused" />)
      expect(screen.getByTitle("Resume")).not.toBeDisabled()
    })

    it("disables stop button when idle", () => {
      render(<AgentControls state="idle" />)
      expect(screen.getByTitle("Stop")).toBeDisabled()
    })

    it("enables stop button when running", () => {
      render(<AgentControls state="running" />)
      expect(screen.getByTitle("Stop")).not.toBeDisabled()
    })

    it("disables all buttons when disabled prop is true", () => {
      render(<AgentControls state="running" disabled />)
      const buttons = screen.getAllByRole("button")
      for (const button of buttons) {
        expect(button).toBeDisabled()
      }
    })
  })

  describe("click handlers", () => {
    it("calls onNewSession when new session button is clicked", () => {
      const handler = vi.fn()
      render(<AgentControls state="idle" onNewSession={handler} />)
      fireEvent.click(screen.getByTitle("New session"))
      expect(handler).toHaveBeenCalledOnce()
    })

    it("calls onPause when pause button is clicked", () => {
      const handler = vi.fn()
      render(<AgentControls state="running" onPause={handler} />)
      fireEvent.click(screen.getByTitle("Pause"))
      expect(handler).toHaveBeenCalledOnce()
    })

    it("calls onResume when resume button is clicked", () => {
      const handler = vi.fn()
      render(<AgentControls state="paused" onResume={handler} />)
      fireEvent.click(screen.getByTitle("Resume"))
      expect(handler).toHaveBeenCalledOnce()
    })

    it("calls onStop when stop button is clicked", () => {
      const handler = vi.fn()
      render(<AgentControls state="running" onStop={handler} />)
      fireEvent.click(screen.getByTitle("Stop"))
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe("color overrides", () => {
    it("applies green color to resume button", () => {
      render(<AgentControls state="paused" />)
      const resumeButton = screen.getByTitle("Resume")
      expect(resumeButton.className).toMatch(/text-green-600/)
    })

    it("applies red hover color to stop button", () => {
      render(<AgentControls state="running" />)
      const stopButton = screen.getByTitle("Stop")
      expect(stopButton.className).toMatch(/hover:text-red-600/)
    })
  })

  describe("container", () => {
    it("applies className to container div", () => {
      const { container } = render(<AgentControls state="idle" className="my-custom-class" />)
      const wrapper = container.firstElementChild
      expect(wrapper).toHaveClass("my-custom-class")
    })
  })
})
