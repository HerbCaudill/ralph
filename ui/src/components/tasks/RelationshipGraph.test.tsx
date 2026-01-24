import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelationshipGraph } from "./RelationshipGraph"
import type { Task } from "@/types"

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

describe("RelationshipGraph", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockTasks = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading indicator while fetching", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<RelationshipGraph taskId="rui-123" />)

      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })
  })

  describe("current task display", () => {
    it("displays the current task in the center when there are relationships", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" },
      ]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.getByText("Current")).toBeInTheDocument()
      expect(screen.getByText("Current task")).toBeInTheDocument()
      expect(screen.getByText("123")).toBeInTheDocument()
    })

    it("shows task ID without prefix when there are relationships", async () => {
      mockTasks = [
        { id: "rui-456", title: "Test task", status: "open" },
        { id: "rui-456.1", title: "Child task", status: "open", parent: "rui-456" },
      ]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-456", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-456" />)

      await waitFor(() => {
        expect(screen.getByText("456")).toBeInTheDocument()
      })
    })
  })

  describe("parent relationship", () => {
    it("displays parent task when provided", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(
        <RelationshipGraph
          taskId="rui-123"
          parent={{ id: "rui-100", title: "Parent epic", status: "open" }}
        />,
      )

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.getByText("Parent epic")).toBeInTheDocument()
      expect(screen.getByText("100")).toBeInTheDocument()
    })

    it("renders parent task as link with correct href", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(
        <RelationshipGraph
          taskId="rui-123"
          parent={{ id: "rui-100", title: "Parent epic", status: "open" }}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("Parent epic")).toBeInTheDocument()
      })

      const link = screen.getByRole("link", { name: /Parent epic/i })
      expect(link).toHaveAttribute("href", "/issue/rui-100")
    })

    it("does not show parent section when no parent", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" parent={null} />)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.queryByText("Parent")).not.toBeInTheDocument()
    })
  })

  describe("child tasks", () => {
    it("displays child tasks from the store", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child task 1", status: "open", parent: "rui-123" },
        { id: "rui-123.2", title: "Child task 2", status: "in_progress", parent: "rui-123" },
        { id: "rui-456", title: "Unrelated task", status: "open" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      expect(screen.getByText("Children")).toBeInTheDocument()
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 2")).toBeInTheDocument()
      expect(screen.queryByText("Unrelated task")).not.toBeInTheDocument()
    })

    it("renders child task as link with correct href", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child task 1", status: "open", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Child task 1")).toBeInTheDocument()
      })

      const link = screen.getByRole("link", { name: /Child task 1/i })
      expect(link).toHaveAttribute("href", "/issue/rui-123.1")
    })
  })

  describe("blockers", () => {
    it("displays blocking tasks from API", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Blocked by")).toBeInTheDocument()
      })
      expect(screen.getByText("Blocking task 1")).toBeInTheDocument()
    })

    it("renders blocker task as link with correct href", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Blocking task 1")).toBeInTheDocument()
      })

      const link = screen.getByRole("link", { name: /Blocking task 1/i })
      expect(link).toHaveAttribute("href", "/issue/rui-100")
    })
  })

  describe("dependents", () => {
    it("displays tasks that depend on this task", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        // Wait for the dependent task to appear, indicating the section is rendered
        expect(screen.getByText("Depends on main task")).toBeInTheDocument()
      })
    })

    it("renders dependent task as link with correct href", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Depends on main task")).toBeInTheDocument()
      })

      const link = screen.getByRole("link", { name: /Depends on main task/i })
      expect(link).toHaveAttribute("href", "/issue/rui-200")
    })
  })

  describe("empty state", () => {
    it("does not render when there are no relationships", async () => {
      mockTasks = [{ id: "rui-123", title: "Current task", status: "open" }]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      const { container } = render(<RelationshipGraph taskId="rui-123" parent={null} />)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Should not render the Relationships label when empty
      expect(screen.queryByText("Relationships")).not.toBeInTheDocument()
      expect(container.firstChild).toBeNull()
    })
  })

  describe("legend", () => {
    it("displays legend when there are relationships", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Parent/Child")).toBeInTheDocument()
      })
      expect(screen.getByText("Blocks")).toBeInTheDocument()
    })
  })

  describe("status display", () => {
    it("shows correct status icon and styling for open tasks", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child task", status: "open", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Child task")).toBeInTheDocument()
      })
    })

    it("shows correct styling for closed tasks", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Closed child", status: "closed", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Closed child")).toBeInTheDocument()
      })

      const taskTitle = screen.getByText("Closed child")
      expect(taskTitle).toHaveClass("line-through")
    })

    it("shows correct styling for in_progress tasks", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Active child", status: "in_progress", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-123", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Active child")).toBeInTheDocument()
      })
    })
  })

  describe("API calls", () => {
    it("fetches task details for the correct task ID", async () => {
      mockTasks = [{ id: "rui-456", title: "Test task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ ok: true, issue: { id: "rui-456", dependencies: [], dependents: [] } }),
      })

      render(<RelationshipGraph taskId="rui-456" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-456")
      })
    })

    it("handles API errors gracefully", async () => {
      mockTasks = [{ id: "rui-123", title: "Test task", status: "open" }]
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Not found" }),
      })

      const { container } = render(<RelationshipGraph taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Should not crash, just show nothing (no relationships found)
      expect(container.firstChild).toBeNull()
    })
  })

  describe("mixed relationships", () => {
    it("displays all relationship types together", async () => {
      mockTasks = [
        { id: "rui-123", title: "Current task", status: "open" },
        { id: "rui-123.1", title: "Child 1", status: "open", parent: "rui-123" },
        { id: "rui-123.2", title: "Child 2", status: "closed", parent: "rui-123" },
      ]

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, issue: sampleTaskWithDependencies }),
      })

      render(
        <RelationshipGraph
          taskId="rui-123"
          parent={{ id: "rui-50", title: "Parent task", status: "open" }}
        />,
      )

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      // Parent
      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.getByText("Parent task")).toBeInTheDocument()

      // Current
      expect(screen.getByText("Current")).toBeInTheDocument()
      expect(screen.getByText("Current task")).toBeInTheDocument()

      // Children
      expect(screen.getByText("Children")).toBeInTheDocument()
      expect(screen.getByText("Child 1")).toBeInTheDocument()
      expect(screen.getByText("Child 2")).toBeInTheDocument()

      // Blockers
      expect(screen.getByText("Blocked by")).toBeInTheDocument()
      expect(screen.getByText("Blocking task 1")).toBeInTheDocument()

      // Dependents
      // Note: "Blocks" appears in both legend and section, so we need to be more specific
      expect(screen.getByText("Depends on main task")).toBeInTheDocument()
    })
  })
})
