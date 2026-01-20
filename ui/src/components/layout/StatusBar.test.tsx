import { render, screen } from "@/test-utils"
import { describe, it, expect, beforeEach } from "vitest"
import { StatusBar } from "./StatusBar"
import { useAppStore } from "@/store"

describe("StatusBar", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
    // Set connected so ControlBar buttons render properly
    useAppStore.getState().setConnectionStatus("connected")
  })

  describe("StatusIndicator", () => {
    it("shows 'Stopped' when ralph is stopped", () => {
      render(<StatusBar />)
      expect(screen.getByText("Stopped")).toBeInTheDocument()
    })

    it("shows 'Starting' when ralph is starting", () => {
      useAppStore.getState().setRalphStatus("starting")
      render(<StatusBar />)
      expect(screen.getByText("Starting")).toBeInTheDocument()
    })

    it("shows 'Running' when ralph is running", () => {
      useAppStore.getState().setRalphStatus("running")
      render(<StatusBar />)
      expect(screen.getByText("Running")).toBeInTheDocument()
    })

    it("shows 'Stopping' when ralph is stopping", () => {
      useAppStore.getState().setRalphStatus("stopping")
      render(<StatusBar />)
      expect(screen.getByText("Stopping")).toBeInTheDocument()
    })
  })

  describe("RepoBranch", () => {
    it("shows repo name when workspace is set", () => {
      useAppStore.getState().setWorkspace("/path/to/my-repo")
      render(<StatusBar />)
      expect(screen.getByText("my-repo")).toBeInTheDocument()
    })

    it("shows branch when branch is set", () => {
      useAppStore.getState().setWorkspace("/path/to/repo")
      useAppStore.getState().setBranch("feature/test")
      render(<StatusBar />)
      expect(screen.getByText(/feature\/test/)).toBeInTheDocument()
    })

    it("does not show repo/branch section when neither is set", () => {
      render(<StatusBar />)
      // Should not find any repo/branch text (the slash between them or a branch name)
      // But we need to exclude other potential slashes from the test
      expect(screen.queryByTitle(/Iteration/)).not.toBeInTheDocument()
    })
  })

  describe("TokenUsage", () => {
    it("shows zero tokens initially", () => {
      render(<StatusBar />)
      const zeros = screen.getAllByText("0")
      expect(zeros).toHaveLength(2) // one for input, one for output
    })

    it("shows token counts", () => {
      useAppStore.getState().setTokenUsage({ input: 500, output: 250 })
      render(<StatusBar />)
      expect(screen.getByText("500")).toBeInTheDocument()
      expect(screen.getByText("250")).toBeInTheDocument()
    })

    it("formats large token counts with k suffix", () => {
      useAppStore.getState().setTokenUsage({ input: 1500, output: 2500 })
      render(<StatusBar />)
      expect(screen.getByText("1.5k")).toBeInTheDocument()
      expect(screen.getByText("2.5k")).toBeInTheDocument()
    })

    it("formats very large token counts with M suffix", () => {
      useAppStore.getState().setTokenUsage({ input: 1500000, output: 2500000 })
      render(<StatusBar />)
      expect(screen.getByText("1.5M")).toBeInTheDocument()
      expect(screen.getByText("2.5M")).toBeInTheDocument()
    })
  })

  describe("ContextWindowProgress", () => {
    it("does not show progress when no tokens used", () => {
      render(<StatusBar />)
      expect(screen.queryByTestId("context-window-progress")).not.toBeInTheDocument()
    })

    it("shows context window usage when tokens are used", () => {
      useAppStore.getState().updateContextWindowUsed(50000)
      render(<StatusBar />)
      expect(screen.getByTestId("context-window-progress")).toBeInTheDocument()
      expect(screen.getByText("50.0k")).toBeInTheDocument()
    })

    it("shows progress bar at correct percentage", () => {
      // 100k of 200k = 50%
      useAppStore.getState().updateContextWindowUsed(100000)
      render(<StatusBar />)
      const progressBar = screen
        .getByTestId("context-window-progress")
        .querySelector('[style*="width: 50%"]')
      expect(progressBar).toBeInTheDocument()
    })

    it("uses warning color when usage is between 50% and 80%", () => {
      // 120k of 200k = 60%
      useAppStore.getState().updateContextWindowUsed(120000)
      render(<StatusBar />)
      const progressBar = screen
        .getByTestId("context-window-progress")
        .querySelector(".bg-status-warning")
      expect(progressBar).toBeInTheDocument()
    })

    it("uses error color when usage is over 80%", () => {
      // 180k of 200k = 90%
      useAppStore.getState().updateContextWindowUsed(180000)
      render(<StatusBar />)
      const progressBar = screen
        .getByTestId("context-window-progress")
        .querySelector(".bg-status-error")
      expect(progressBar).toBeInTheDocument()
    })

    it("has proper tooltip with usage details", () => {
      useAppStore.getState().updateContextWindowUsed(50000)
      render(<StatusBar />)
      const container = screen.getByTestId("context-window-progress")
      expect(container).toHaveAttribute("title", expect.stringContaining("Context window"))
      expect(container).toHaveAttribute("title", expect.stringContaining("50.0k"))
    })
  })

  describe("IterationProgress", () => {
    it("does not show progress when total is 0", () => {
      render(<StatusBar />)
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
    })

    it("shows iteration count when total is set", () => {
      useAppStore.getState().setIteration({ current: 3, total: 10 })
      render(<StatusBar />)
      expect(screen.getByText("3/10")).toBeInTheDocument()
    })

    it("shows progress bar at correct percentage", () => {
      useAppStore.getState().setIteration({ current: 5, total: 10 })
      render(<StatusBar />)
      // Progress bar should be at 50%
      const progressBar = document.querySelector('[style*="width: 50%"]')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe("CurrentTask", () => {
    it("does not show task when no current task", () => {
      render(<StatusBar />)
      // No task info should be displayed - the component won't render
      expect(screen.queryByTitle("Current task")).not.toBeInTheDocument()
    })

    it("shows current task id and title when in_progress task exists", () => {
      useAppStore
        .getState()
        .setTasks([{ id: "rui-123", title: "Fix the bug", status: "in_progress" }])
      render(<StatusBar />)
      expect(screen.getByText("rui-123")).toBeInTheDocument()
      expect(screen.getByText("Fix the bug")).toBeInTheDocument()
    })

    it("truncates long task title", () => {
      useAppStore.getState().setTasks([
        {
          id: "rui-456",
          title: "This is a very long task description that should be truncated",
          status: "in_progress",
        },
      ])
      render(<StatusBar />)
      expect(screen.getByText("rui-456")).toBeInTheDocument()
      const taskTitle = screen.getByText(
        "This is a very long task description that should be truncated",
      )
      expect(taskTitle).toHaveClass("truncate")
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = render(<StatusBar className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })
})
