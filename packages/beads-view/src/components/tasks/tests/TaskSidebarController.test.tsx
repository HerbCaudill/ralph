import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskSidebarController } from ".././TaskSidebarController"
import { beadsViewStore } from "@herbcaudill/beads-view"

// Mock fetch for tasks API
const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()

  // Default mock for tasks fetch
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ok: true, issues: [] }),
  })

  // Reset store state
  beadsViewStore.setState({
    tasks: [],
    taskSearchQuery: "",
    selectedTaskId: null,
    visibleTaskIds: [],
    closedTimeFilter: "past_day",
    statusCollapsedState: { open: false, deferred: true, closed: true },
    parentCollapsedState: {},
    taskInputDraft: "",
    commentDrafts: {},
    initialTaskCount: 0,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TaskSidebarController", () => {
  describe("quick task input", () => {
    it("renders the quick task input by default", async () => {
      render(<TaskSidebarController />)

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      // Quick task input should be present
      expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument()
    })

    it("does not render quick task input when hideQuickInput is true", async () => {
      render(<TaskSidebarController hideQuickInput />)

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      // Quick task input should not be present
      expect(screen.queryByRole("textbox", { name: /new task title/i })).not.toBeInTheDocument()
    })

    it("refreshes task list when task is created", async () => {
      const mockIssue = { id: "rui-123", title: "New task", status: "open", priority: 2 }
      mockFetch
        // First call: initial tasks fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [] }),
        })
        // Second call: task creation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issue: mockIssue }),
        })
        // Third call: refresh after creation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [mockIssue] }),
        })

      render(<TaskSidebarController />)

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
      })

      // Type in the quick add input
      const input = screen.getByRole("textbox", { name: /new task title/i })
      fireEvent.change(input, { target: { value: "New task" } })

      // Submit the task
      fireEvent.keyDown(input, { key: "Enter" })

      // Wait for the task to be created and list to refresh
      await waitFor(() => {
        // Should have made 3 fetch calls: initial, create, refresh
        expect(mockFetch).toHaveBeenCalledTimes(3)
      })

      // The task creation call should have been made
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "New task" }),
        }),
      )
    })
  })

  describe("search input", () => {
    it("renders the search input", async () => {
      render(<TaskSidebarController />)

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      // Search input should be present
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })
  })

  describe("progress bar", () => {
    it("renders the progress bar", async () => {
      render(<TaskSidebarController />)

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      // Progress bar section should be present (with 0/0 tasks)
      expect(screen.getByText(/tasks$/i)).toBeInTheDocument()
    })
  })
})
