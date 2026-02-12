import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { RunDuration } from "../RunDuration"

describe("RunDuration", () => {
  describe("visibility", () => {
    it("does not render when elapsedMs is 0", () => {
      render(<RunDuration elapsedMs={0} />)
      expect(screen.queryByTestId("run-duration")).not.toBeInTheDocument()
    })

    it("does not render when elapsedMs is negative", () => {
      render(<RunDuration elapsedMs={-1000} />)
      expect(screen.queryByTestId("run-duration")).not.toBeInTheDocument()
    })

    it("renders when elapsedMs is positive", () => {
      render(<RunDuration elapsedMs={1000} />)
      expect(screen.getByTestId("run-duration")).toBeInTheDocument()
    })
  })

  describe("time formatting", () => {
    it("shows seconds only when under 60 seconds", () => {
      render(<RunDuration elapsedMs={5000} />)
      expect(screen.getByText("5s")).toBeInTheDocument()
    })

    it("shows minutes and seconds when over 60 seconds", () => {
      render(<RunDuration elapsedMs={65000} />) // 1:05
      expect(screen.getByText("1:05")).toBeInTheDocument()
    })

    it("shows hours, minutes, and seconds when over 60 minutes", () => {
      render(<RunDuration elapsedMs={3723000} />) // 1:02:03
      expect(screen.getByText("1:02:03")).toBeInTheDocument()
    })

    it("pads single-digit minutes and seconds with zeros", () => {
      render(<RunDuration elapsedMs={3661000} />) // 1:01:01
      expect(screen.getByText("1:01:01")).toBeInTheDocument()
    })
  })

  describe("icon", () => {
    it("shows clock icon", () => {
      render(<RunDuration elapsedMs={5000} />)
      const container = screen.getByTestId("run-duration")
      expect(container.querySelector("svg")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has title attribute", () => {
      render(<RunDuration elapsedMs={5000} />)
      const container = screen.getByTestId("run-duration")
      expect(container).toHaveAttribute("title", "Time running")
    })
  })

  describe("custom className", () => {
    it("applies custom className", () => {
      render(<RunDuration elapsedMs={5000} className="custom-class" />)
      const container = screen.getByTestId("run-duration")
      expect(container).toHaveClass("custom-class")
    })
  })
})
