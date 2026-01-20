import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelatedTasks } from "./RelatedTasks"
import { TaskDialogProvider } from "@/contexts"
import type { Task } from "@/store"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock zustand store
vi.mock("@/store", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useAppStore: (selector: (state: unknown) => unknown) => {
      const mockState = {
        tasks: mockTasks,
        issuePrefix: "rui",
      }
      return selector(mockState)
    },
    selectTasks: (state: { tasks: Task[] }) => state.tasks,
    selectIssuePrefix: (state: { issuePrefix: string | null }) => state.issuePrefix,
  }
})

// Mock tasks for the store
let mockTasks: Task[] = []

// Sample API response with dependencies
const sampleTaskWithDependencies = {
  id: "rui-123",
  title: "Main task",
  status: "open",
  priority: 2,
  dependencies: [
    {
      id: "rui-100",
      title: "Blocking task 1",
      status: "open",
      dependency_type: "blocks",
    },
    {
      id: "rui-101",
      title: "Parent epic",
      status: "open",
      dependency_type: "parent-child",
    },
  ],
  dependents: [
    {
      id: "rui-200",
      title: "Depends on main task",
      status: "in_progress",
      dependency_type: "blocks",
    },
  ],
}

describe("RelatedTasks", () => {
  const mockOpenTaskById = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    mockOpenTaskById.mockReset()
    mockTasks = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithContext = (taskId: string) => {
    return render(
      <TaskDialogProvider openTaskById={mockOpenTaskById}>
        <RelatedTasks taskId={taskId} />
      </TaskDialogProvider>,
    )
  }

  describe("loading state", () => {
    it("shows loading indicator while fetching", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithContext("rui-123")

      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })
  })

  describe("child tasks", () => {
    it("displays child tasks from the store", async () => {
      mockTasks = [
        { id: "rui-123.1", title: "Child task 1", status: "open", parent: "rui-123" },
        { id: "rui-123.2", title: "Child task 2", status: "in_progress", parent: "rui-123" },
        { id: "rui-456", title: "Unrelated task", status: "open" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 2")).toBeInTheDocument()
      expect(screen.queryByText("Unrelated task")).not.toBeInTheDocument()
    })

    it("shows Children section with count", async () => {
      mockTasks = [
        { id: "rui-123.1", title: "Child 1", status: "open", parent: "rui-123" },
        { id: "rui-123.2", title: "Child 2", status: "closed", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Children (2)")).toBeInTheDocument()
      })
    })
  })

  describe("blockers", () => {
    it("displays blocking tasks from API", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Blocking task 1")).toBeInTheDocument()
      })
      expect(screen.getByText("Parent epic")).toBeInTheDocument()
    })

    it("shows Blocked by section with count", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Blocked by (2)")).toBeInTheDocument()
      })
    })
  })

  describe("dependents", () => {
    it("displays tasks that depend on this task", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Depends on main task")).toBeInTheDocument()
      })
    })

    it("shows Blocks section with count", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Blocks (1)")).toBeInTheDocument()
      })
    })
  })

  describe("task links", () => {
    it("displays task IDs without prefix", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("123.1")).toBeInTheDocument()
      })
    })

    it("opens task dialog when task is clicked", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Child task"))

      expect(mockOpenTaskById).toHaveBeenCalledWith("rui-123.1")
    })
  })

  describe("collapsible sections", () => {
    it("collapses section when header is clicked", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })

      // Click the header to collapse
      fireEvent.click(screen.getByText("Children (1)"))

      // Task should be hidden after collapse
      expect(screen.queryByText("Child task")).not.toBeInTheDocument()
    })

    it("expands section when header is clicked again", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })

      // Click to collapse
      fireEvent.click(screen.getByText("Children (1)"))
      expect(screen.queryByText("Child task")).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText("Children (1)"))
      expect(screen.getByText("Child task")).toBeInTheDocument()
    })
  })

  describe("empty state", () => {
    it("does not render when there are no related tasks", async () => {
      mockTasks = []

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      const { container } = renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Should not render the Related label when empty
      expect(screen.queryByText("Related")).not.toBeInTheDocument()
      expect(container.firstChild).toBeNull()
    })
  })

  describe("API calls", () => {
    it("fetches task details for the correct task ID", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-456" } }),
      })

      renderWithContext("rui-456")

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-456")
      })
    })

    it("handles API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Not found" }),
      })

      const { container } = renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Should not crash, just show nothing
      expect(container.firstChild).toBeNull()
    })
  })

  describe("status display", () => {
    it("shows closed tasks with reduced opacity and strikethrough", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Closed child", status: "closed", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Closed child")).toBeInTheDocument()
      })

      const taskTitle = screen.getByText("Closed child")
      expect(taskTitle).toHaveClass("line-through")
    })
  })
})
