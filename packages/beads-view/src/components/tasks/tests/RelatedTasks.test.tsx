import { render, screen, waitFor, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelatedTasks } from ".././RelatedTasks"
import { beadsViewStore } from "../../../store"
import type { Task } from "../../../types"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock tasks passed as props
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
  beforeEach(() => {
    mockFetch.mockReset()
    mockTasks = []
    // Set up the store with the issue prefix for tests that check ID display
    beadsViewStore.setState({ issuePrefix: "rui" })
  })

  afterEach(() => {
    vi.clearAllMocks()
    beadsViewStore.setState({ issuePrefix: null })
  })

  const renderWithContext = (taskId: string) => {
    return render(<RelatedTasks taskId={taskId} allTasks={mockTasks} issuePrefix="rui" />)
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

    it("shows Subtasks section with count", async () => {
      mockTasks = [
        { id: "rui-123.1", title: "Child 1", status: "open", parent: "rui-123" },
        { id: "rui-123.2", title: "Child 2", status: "closed", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByLabelText("Subtasks section, 2 tasks")).toBeInTheDocument()
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
    })

    it("excludes parent-child dependencies from blockers", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Blocking task 1")).toBeInTheDocument()
      })

      // Parent epic has dependency_type "parent-child" and should NOT appear in Blocked by
      expect(screen.queryByText("Parent epic")).not.toBeInTheDocument()
    })

    it("shows Blocked by section with count excluding parent-child", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        // Only the "blocks" dependency should be counted, not "parent-child"
        expect(screen.getByLabelText("Blocked by section, 1 task")).toBeInTheDocument()
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
        expect(screen.getByLabelText("Blocks section, 1 task")).toBeInTheDocument()
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

    it("renders task as clickable button", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })

      // Task should be a button (TaskCard uses button role for the clickable content)
      const button = screen.getByRole("button", { name: /Child task/ })
      expect(button).toBeInTheDocument()
    })
  })

  describe("section headers", () => {
    it("section headers are collapsible and content is visible by default", async () => {
      mockTasks = [{ id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" }]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [] } }),
      })

      renderWithContext("rui-123")

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })

      // Verify header is visible with correct aria-label
      expect(screen.getByLabelText("Subtasks section, 1 task")).toBeInTheDocument()
      // Verify content is visible by default
      expect(screen.getByText("Child task")).toBeInTheDocument()

      // Header should be a button (collapsible)
      const header = screen.getByLabelText("Subtasks section, 1 task")
      expect(header).toHaveAttribute("role", "button")
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
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-456", undefined)
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

  describe("blocker management", () => {
    const mockTask = {
      id: "rui-123",
      title: "Main task",
      status: "open" as const,
      priority: 2,
    }

    const renderWithTask = (taskId: string, task: typeof mockTask, readOnly = false) => {
      return render(
        <RelatedTasks
          taskId={taskId}
          task={task}
          readOnly={readOnly}
          allTasks={mockTasks}
          issuePrefix="rui"
        />,
      )
    }

    it("shows add blocker button when not read-only and task is provided", async () => {
      mockTasks = [{ id: "rui-999", title: "Available task", status: "open" }]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      renderWithTask("rui-123", mockTask)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.getByText("Add blocker")).toBeInTheDocument()
    })

    it("does not show add blocker button when read-only", async () => {
      mockTasks = [{ id: "rui-999", title: "Available task", status: "open" }]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      renderWithTask("rui-123", mockTask, true)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.queryByText("Add blocker")).not.toBeInTheDocument()
    })

    it("shows remove button on hover for blockers when not read-only", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            issue: {
              id: "rui-123",
              dependencies: [
                {
                  id: "rui-100",
                  title: "Blocking task",
                  status: "open",
                  dependency_type: "blocks",
                },
              ],
              dependents: [],
            },
          }),
      })

      renderWithTask("rui-123", mockTask)

      await waitFor(() => {
        expect(screen.getByText("Blocking task")).toBeInTheDocument()
      })

      // The remove button should be present (visible on hover via CSS)
      // The TaskCard uses a generic "Remove" button
      const removeButton = screen.getByRole("button", { name: "Remove" })
      expect(removeButton).toBeInTheDocument()
    })

    it("does not show remove button when read-only", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            issue: {
              id: "rui-123",
              dependencies: [
                {
                  id: "rui-100",
                  title: "Blocking task",
                  status: "open",
                  dependency_type: "blocks",
                },
              ],
              dependents: [],
            },
          }),
      })

      renderWithTask("rui-123", mockTask, true)

      await waitFor(() => {
        expect(screen.getByText("Blocking task")).toBeInTheDocument()
      })

      expect(
        screen.queryByRole("button", { name: /remove rui-100 as blocker/i }),
      ).not.toBeInTheDocument()
    })

    it("calls API to add a blocker when selected from combobox", async () => {
      mockTasks = [{ id: "rui-999", title: "Available task", status: "open" }]

      mockFetch
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              ok: true,
              issue: { id: "rui-123", dependencies: [], dependents: [] },
            }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ ok: true }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              ok: true,
              issue: {
                id: "rui-123",
                dependencies: [
                  {
                    id: "rui-999",
                    title: "Available task",
                    status: "open",
                    dependency_type: "blocks",
                  },
                ],
                dependents: [],
              },
            }),
        })

      renderWithTask("rui-123", mockTask)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Click the add blocker button
      const addButton = screen.getByText("Add blocker")
      await act(async () => {
        fireEvent.click(addButton)
      })

      // Wait for the combobox to open and find the task
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search tasks...")).toBeInTheDocument()
      })

      // Select the available task
      const taskOption = screen.getByText("Available task")
      await act(async () => {
        fireEvent.click(taskOption)
      })

      // Verify the API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-123/blockers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockerId: "rui-999" }),
        })
      })
    })

    it("calls API to remove a blocker when remove button is clicked", async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              ok: true,
              issue: {
                id: "rui-123",
                dependencies: [
                  {
                    id: "rui-100",
                    title: "Blocking task",
                    status: "open",
                    dependency_type: "blocks",
                  },
                ],
                dependents: [],
              },
            }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ ok: true }),
        })

      renderWithTask("rui-123", mockTask)

      await waitFor(() => {
        expect(screen.getByText("Blocking task")).toBeInTheDocument()
      })

      // Click the remove button
      const removeButton = screen.getByRole("button", { name: "Remove" })
      await act(async () => {
        fireEvent.click(removeButton)
      })

      // Verify the API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-123/blockers/rui-100", {
          method: "DELETE",
        })
      })
    })

    it("does not show parent-child dependencies as blockers", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            issue: {
              id: "rui-123",
              dependencies: [
                {
                  id: "rui-parent",
                  title: "Parent epic",
                  status: "open",
                  dependency_type: "parent-child",
                },
              ],
              dependents: [],
            },
          }),
      })

      renderWithTask("rui-123", mockTask)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Parent-child dependencies should not appear in the Blocked by section
      expect(screen.queryByText("Parent epic")).not.toBeInTheDocument()
    })
  })
})
