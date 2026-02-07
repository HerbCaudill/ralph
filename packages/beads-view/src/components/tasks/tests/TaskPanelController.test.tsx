import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskPanelController } from "../TaskPanelController"
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

describe("TaskPanelController", () => {
  describe("quick task input", () => {
    it("hides the quick task input by default", async () => {
      render(<TaskPanelController />)

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      expect(screen.queryByRole("textbox", { name: /new task title/i })).not.toBeInTheDocument()
    })

    it("renders quick task input when hideQuickInput is false", async () => {
      render(<TaskPanelController hideQuickInput={false} />)

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument()
    })

    it("refreshes task list when task is created", async () => {
      const mockIssue = { id: "rui-123", title: "New task", status: "open", priority: 2 }
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issue: mockIssue }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [mockIssue] }),
        })

      render(<TaskPanelController hideQuickInput={false} />)

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
      })

      const input = screen.getByRole("textbox", { name: /new task title/i })
      fireEvent.change(input, { target: { value: "New task" } })
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3)
      })

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
      render(<TaskPanelController />)

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })
  })

  describe("progress bar", () => {
    it("renders the progress bar", async () => {
      render(<TaskPanelController />)

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      })

      expect(screen.getByText(/tasks$/i)).toBeInTheDocument()
    })
  })
})
