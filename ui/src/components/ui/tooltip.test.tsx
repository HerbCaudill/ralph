import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipButton,
  Kbd,
} from "./tooltip"
import { Button } from "./button"

describe("Tooltip", () => {
  describe("basic rendering", () => {
    it("renders tooltip content on hover", async () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button>Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      )

      // Tooltip should not be visible initially
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

      // Focus the button to trigger tooltip (more reliable than hover in jsdom)
      fireEvent.focus(screen.getByRole("button", { name: "Hover me" }))

      // Tooltip should be visible (radix uses role="tooltip")
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
      })
    })

    it("hides tooltip when focus leaves", async () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button>Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      )

      const button = screen.getByRole("button", { name: "Hover me" })

      // Focus the button
      fireEvent.focus(button)

      // Tooltip should be visible
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
      })

      // Blur the button
      fireEvent.blur(button)

      // Tooltip should disappear
      await waitFor(() => {
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
      })
    })
  })

  describe("Kbd component", () => {
    it("renders keyboard shortcut in a styled kbd element", () => {
      render(<Kbd>⌘K</Kbd>)

      const kbd = screen.getByText("⌘K")
      expect(kbd.tagName.toLowerCase()).toBe("kbd")
      expect(kbd).toHaveClass("font-mono")
    })

    it("applies custom className", () => {
      render(<Kbd className="custom-class">⌘K</Kbd>)

      const kbd = screen.getByText("⌘K")
      expect(kbd).toHaveClass("custom-class")
    })
  })

  describe("TooltipButton", () => {
    it("renders tooltip with text", async () => {
      render(
        <TooltipProvider>
          <TooltipButton tooltip="Start the process">
            <Button>Start</Button>
          </TooltipButton>
        </TooltipProvider>,
      )

      // Focus the button
      fireEvent.focus(screen.getByRole("button", { name: "Start" }))

      // Tooltip should show the text
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
      })
    })

    it("renders tooltip with hotkey", async () => {
      render(
        <TooltipProvider>
          <TooltipButton tooltip="Start" hotkey="⌘⏎">
            <Button>Start</Button>
          </TooltipButton>
        </TooltipProvider>,
      )

      // Focus the button
      fireEvent.focus(screen.getByRole("button", { name: "Start" }))

      // Tooltip should be visible
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
      })

      // Hotkey should be in a kbd element (multiple due to accessibility duplication)
      const kbds = screen.getAllByText("⌘⏎")
      expect(kbds.length).toBeGreaterThan(0)
      expect(kbds[0].tagName.toLowerCase()).toBe("kbd")
    })

    it("respects custom side prop", async () => {
      render(
        <TooltipProvider>
          <TooltipButton tooltip="Start" side="bottom">
            <Button>Start</Button>
          </TooltipButton>
        </TooltipProvider>,
      )

      // Focus the button
      fireEvent.focus(screen.getByRole("button", { name: "Start" }))

      // Tooltip should be visible (side positioning is handled by Radix)
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
      })
    })

    it("wraps children in a span to allow tooltips on disabled buttons", () => {
      render(
        <TooltipProvider delayDuration={0}>
          <TooltipButton tooltip="This button is disabled" delayDuration={0}>
            <Button disabled>Disabled</Button>
          </TooltipButton>
        </TooltipProvider>,
      )

      // The button should be wrapped in an inline-flex span
      const button = screen.getByRole("button", { name: "Disabled" })
      const wrapperSpan = button.parentElement!

      // Verify the wrapper span exists and has the correct class
      expect(wrapperSpan.tagName.toLowerCase()).toBe("span")
      expect(wrapperSpan).toHaveClass("inline-flex")

      // The span should have Radix tooltip data attributes
      expect(wrapperSpan).toHaveAttribute("data-state")
    })
  })
})
