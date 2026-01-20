import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react"
import { TaskDetailsDialog } from "./TaskDetailsDialog"
import { useAppStore } from "@/store"
import type { TaskCardTask } from "./TaskCard"

// Helper functions

function typeInInput(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// Mock fetch for event log tests
const originalFetch = globalThis.fetch

// Default mock fetch that handles labels API calls
function createMockFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    // Handle labels fetch
    if (typeof url === "string" && url.includes("/api/tasks/") && url.includes("/labels")) {
      // DELETE request - remove label
      if (options?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: { status: "removed" } }),
        })
      }
      // POST request - add label
      if (options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: { status: "added" } }),
        })
      }
      // GET request - fetch labels
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, labels: [] }),
      })
    }
    // Handle event log fetch
    if (typeof url === "string" && url.includes("/api/eventlogs")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            eventlog: { id: overrides.eventLogId ?? "mock-event-log-123" },
          }),
      })
    }
    // Handle comments fetch
    if (typeof url === "string" && url.includes("/comments")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
    }
    // Default response
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })
  })
}

describe("TaskDetailsDialog", () => {
  const mockTask: TaskCardTask = {
    id: "test-123",
    title: "Test Task",
    description: "This is a test description",
    status: "open",
    priority: 2,
    issue_type: "task",
    parent: "parent-456",
  }

  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
    mockOnSave.mockClear()
    // Set up default mock fetch
    globalThis.fetch = createMockFetch()
  })

  afterEach(() => {
    cleanup()
    // Reset the store state
    useAppStore.getState().reset()
    // Restore original fetch
    globalThis.fetch = originalFetch
  })

  describe("rendering", () => {
    it("renders task details when open", () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("test-123")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()
      // Description is rendered as markdown in click-to-edit mode
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("does not render when task is null", () => {
      render(
        <TaskDetailsDialog task={null} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("does not render when open is false", () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("shows task ID in header", () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("test-123")).toBeInTheDocument()
    })

    it("shows task type and parent in dialog", () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Type selector shows "Task" (capitalized)
      expect(screen.getByText("Task")).toBeInTheDocument()
      expect(screen.getByText("parent-456")).toBeInTheDocument()
    })

    it("shows type selector with task default when no type is set", () => {
      const taskWithoutMetadata: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      render(
        <TaskDetailsDialog
          task={taskWithoutMetadata}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      // Type selector defaults to "Task" and Parent shows "None"
      expect(screen.getByText("Task")).toBeInTheDocument()
      expect(screen.getByText("None")).toBeInTheDocument()
    })
  })

  describe("read-only mode", () => {
    it("displays values as text instead of inputs when readOnly", () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Should show text, not inputs
      expect(screen.queryByRole("textbox", { name: /title/i })).not.toBeInTheDocument()
      expect(screen.getByText("Test Task")).toBeInTheDocument()
    })

    it("does not show save button in read-only mode", () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument()
    })

    it("does not show cancel button in read-only mode", () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument()
    })
  })

  describe("editing", () => {
    it("allows editing title", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      expect(titleInput).toHaveValue("Updated Title")
    })

    it("allows editing description via click-to-edit", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Description is initially shown as text, click to edit
      const descriptionText = screen.getByText("This is a test description")
      fireEvent.click(descriptionText)

      // Now the textarea should appear
      const descInput = await screen.findByRole("textbox", { name: /description/i })
      typeInInput(descInput, "Updated description")

      expect(descInput).toHaveValue("Updated description")
    })

    it("enables save button when changes are made", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const saveButton = screen.getByRole("button", { name: /save/i })
      expect(saveButton).toBeDisabled()

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "New Title")

      await waitFor(() => {
        expect(saveButton).toBeEnabled()
      })
    })

    it("disables save button when changes are reverted", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const saveButton = screen.getByRole("button", { name: /save/i })
      const titleInput = screen.getByLabelText(/title/i)

      typeInInput(titleInput, "New Title")
      await waitFor(() => {
        expect(saveButton).toBeEnabled()
      })

      typeInInput(titleInput, mockTask.title)
      await waitFor(() => {
        expect(saveButton).toBeDisabled()
      })
    })

    it("allows editing type via button bar", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Find and click the "Bug" button in the type button bar
      const bugButton = screen.getByRole("button", { name: /bug/i })
      fireEvent.click(bugButton)

      // Save button should now be enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })
    })

    it("saves issue_type when type is changed", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Find and click the "Bug" button in the type button bar
      const bugButton = screen.getByRole("button", { name: /bug/i })
      fireEvent.click(bugButton)

      // Click save
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })
      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { issue_type: "bug" })
    })

    it("allows editing parent via selector", async () => {
      // Set up tasks in store
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open", parent: "parent-456" },
          { id: "parent-456", title: "Parent Task", status: "open" },
          { id: "other-789", title: "Other Task", status: "open" },
        ],
      })

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent selector
      const parentSelect = screen.getByLabelText(/parent/i)
      fireEvent.click(parentSelect)

      // Select "Other Task" from the dropdown
      await waitFor(() => {
        expect(screen.getByRole("option", { name: /other-789/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole("option", { name: /other-789/i }))

      // Save button should now be enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })
    })

    it("saves parent when parent is changed", async () => {
      // Set up tasks in store
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open", parent: "parent-456" },
          { id: "parent-456", title: "Parent Task", status: "open" },
          { id: "other-789", title: "Other Task", status: "open" },
        ],
      })

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent selector
      const parentSelect = screen.getByLabelText(/parent/i)
      fireEvent.click(parentSelect)

      // Select "Other Task" from the dropdown
      await waitFor(() => {
        expect(screen.getByRole("option", { name: /other-789/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole("option", { name: /other-789/i }))

      // Click save
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })
      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { parent: "other-789" })
    })

    it("allows clearing parent by selecting None", async () => {
      // Set up tasks in store
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open", parent: "parent-456" },
          { id: "parent-456", title: "Parent Task", status: "open" },
        ],
      })

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent selector
      const parentSelect = screen.getByLabelText(/parent/i)
      fireEvent.click(parentSelect)

      // Select "None" from the dropdown
      await waitFor(() => {
        expect(screen.getByRole("option", { name: /^None$/i })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole("option", { name: /^None$/i }))

      // Click save
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })
      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { parent: null })
    })

    it("excludes self and children from parent options", async () => {
      // Set up tasks where test-123 has a child
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open" },
          { id: "child-task", title: "Child Task", status: "open", parent: "test-123" },
          { id: "valid-parent", title: "Valid Parent", status: "open" },
        ],
      })

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent selector
      const parentSelect = screen.getByLabelText(/parent/i)
      fireEvent.click(parentSelect)

      // Valid parent should be in the dropdown
      await waitFor(() => {
        expect(screen.getByRole("option", { name: /valid-parent/i })).toBeInTheDocument()
      })

      // Self should not be in the dropdown
      expect(screen.queryByRole("option", { name: /test-123.*Test Task/i })).not.toBeInTheDocument()

      // Child (which has test-123 as parent) should not be in the dropdown
      expect(
        screen.queryByRole("option", { name: /child-task.*Child Task/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe("saving", () => {
    it("calls onSave with updated fields when save is clicked", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "Updated Title" })
    })

    it("only includes changed fields in save payload", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // Should only include title, not description or other unchanged fields
      expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "Updated Title" })
    })

    it("calls onClose after successful save", async () => {
      mockOnSave.mockResolvedValue(undefined)

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it("shows saving state while save is in progress", async () => {
      let resolvePromise: () => void = () => {}
      mockOnSave.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolvePromise = resolve
          }),
      )

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      expect(screen.getByText(/saving/i)).toBeInTheDocument()

      await act(async () => {
        resolvePromise()
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe("closing", () => {
    it("calls onClose when cancel is clicked", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const cancelButton = screen.getByRole("button", { name: /cancel/i })
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it("calls onClose when X button is clicked", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const closeButton = screen.getByRole("button", { name: /close/i })
      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe("state reset", () => {
    it("resets form when task changes", () => {
      const { rerender } = render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()

      const newTask: TaskCardTask = {
        id: "new-456",
        title: "New Task",
        description: "New description",
        status: "in_progress",
        priority: 1,
      }

      rerender(
        <TaskDetailsDialog task={newTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByDisplayValue("New Task")).toBeInTheDocument()
      // Description is rendered as markdown in click-to-edit mode
      expect(screen.getByText("New description")).toBeInTheDocument()
    })
  })

  describe("click-to-edit description", () => {
    it("shows description as markdown text by default", () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Description should be rendered as text, not as a textarea
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: /description/i })).not.toBeInTheDocument()
    })

    it("shows placeholder text when description is empty", () => {
      const taskWithoutDescription: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      render(
        <TaskDetailsDialog
          task={taskWithoutDescription}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      expect(screen.getByText("Click to add description...")).toBeInTheDocument()
    })

    it("switches to edit mode when description is clicked", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description
      fireEvent.click(screen.getByText("This is a test description"))

      // Now the textarea should appear
      const descInput = await screen.findByRole("textbox", { name: /description/i })
      expect(descInput).toBeInTheDocument()
      expect(descInput).toHaveValue("This is a test description")
    })

    it("exits edit mode on blur", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      fireEvent.click(screen.getByText("This is a test description"))

      const descInput = await screen.findByRole("textbox", { name: /description/i })
      expect(descInput).toBeInTheDocument()

      // Blur the textarea
      fireEvent.blur(descInput)

      // Should exit edit mode and show text again
      await waitFor(() => {
        expect(screen.queryByRole("textbox", { name: /description/i })).not.toBeInTheDocument()
      })
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("reverts changes on Escape key", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      fireEvent.click(screen.getByText("This is a test description"))

      const descInput = await screen.findByRole("textbox", { name: /description/i })
      typeInInput(descInput, "Changed description")
      expect(descInput).toHaveValue("Changed description")

      // Press Escape
      fireEvent.keyDown(descInput, { key: "Escape" })

      // Should exit edit mode and show original text
      await waitFor(() => {
        expect(screen.queryByRole("textbox", { name: /description/i })).not.toBeInTheDocument()
      })
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("preserves changes on blur", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      fireEvent.click(screen.getByText("This is a test description"))

      const descInput = await screen.findByRole("textbox", { name: /description/i })
      typeInInput(descInput, "Updated description")

      // Blur the textarea
      fireEvent.blur(descInput)

      // Should exit edit mode and show updated text
      await waitFor(() => {
        expect(screen.queryByRole("textbox", { name: /description/i })).not.toBeInTheDocument()
      })
      expect(screen.getByText("Updated description")).toBeInTheDocument()

      // Save button should be enabled
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
    })

    it("shows 'No description' in read-only mode when description is empty", () => {
      const taskWithoutDescription: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      render(
        <TaskDetailsDialog
          task={taskWithoutDescription}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      expect(screen.getByText("No description")).toBeInTheDocument()
    })
  })

  describe("keyboard shortcuts", () => {
    it("saves on Cmd+Enter (Mac) when changes exist", async () => {
      // Mock Mac platform
      const originalPlatform = navigator.platform
      Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true })

      mockOnSave.mockResolvedValue(undefined)

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      // Press Cmd+Enter
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", metaKey: true })
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "Updated Title" })
      })

      // Restore platform
      Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true })
    })

    it("saves on Ctrl+Enter (Windows/Linux) when changes exist", async () => {
      // Mock Windows platform
      const originalPlatform = navigator.platform
      Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true })

      mockOnSave.mockResolvedValue(undefined)

      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated Title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      // Press Ctrl+Enter
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", ctrlKey: true })
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "Updated Title" })
      })

      // Restore platform
      Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true })
    })

    it("does not save on Cmd+Enter when no changes", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Press Cmd+Enter without making changes
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", metaKey: true })
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it("does not save on Cmd+Enter in read-only mode", async () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Press Cmd+Enter
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", metaKey: true })
      })

      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe("labels", () => {
    it("shows labels section with 'No labels' when task has no labels", async () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Wait for labels to be fetched
      await waitFor(() => {
        expect(screen.getByText("No labels")).toBeInTheDocument()
      })
    })

    it("displays labels when task has labels", async () => {
      // Mock fetch to return labels
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/labels")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, labels: ["urgent", "frontend"] }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        })
      })

      const taskWithLabels: TaskCardTask = {
        ...mockTask,
        labels: ["urgent", "frontend"],
      }

      render(
        <TaskDetailsDialog
          task={taskWithLabels}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      // Wait for labels to be displayed
      await waitFor(() => {
        expect(screen.getByText("urgent")).toBeInTheDocument()
        expect(screen.getByText("frontend")).toBeInTheDocument()
      })
    })

    it("shows Add label button when not in read-only mode", () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("Add label")).toBeInTheDocument()
    })

    it("does not show Add label button in read-only mode", async () => {
      render(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Wait for labels to be fetched
      await waitFor(() => {
        expect(screen.getByText("No labels")).toBeInTheDocument()
      })

      expect(screen.queryByText("Add label")).not.toBeInTheDocument()
    })

    it("shows label input when Add label is clicked", async () => {
      render(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const addButton = screen.getByText("Add label")
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Label name")).toBeInTheDocument()
      })
    })

    it("shows remove button on labels when not in read-only mode", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/labels")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, labels: ["urgent"] }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        })
      })

      const taskWithLabel: TaskCardTask = {
        ...mockTask,
        labels: ["urgent"],
      }

      render(
        <TaskDetailsDialog
          task={taskWithLabel}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("urgent")).toBeInTheDocument()
      })

      // Check for remove button
      expect(screen.getByRole("button", { name: /remove urgent label/i })).toBeInTheDocument()
    })
  })

  describe("event log capture on close", () => {
    it("does not save event log when task is already closed", async () => {
      // Track calls to eventlogs endpoint
      let eventLogsCalled = false
      const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        // Handle labels fetch
        if (typeof url === "string" && url.includes("/api/tasks/") && url.includes("/labels")) {
          if (options?.method === "DELETE" || options?.method === "POST") {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ ok: true }),
            })
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, labels: [] }),
          })
        }
        // Handle event log fetch
        if (typeof url === "string" && url.includes("/api/eventlogs")) {
          eventLogsCalled = true
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, eventlog: { id: "mock-event-log-123" } }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        })
      })
      globalThis.fetch = mockFetch

      const closedTask: TaskCardTask = {
        id: "task-001",
        title: "Already closed task",
        status: "closed",
      }

      render(
        <TaskDetailsDialog
          task={closedTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      // Change the title (not the status)
      const titleInput = screen.getByLabelText(/title/i)
      typeInInput(titleInput, "Updated title")

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
      })

      // Click save
      const saveButton = screen.getByRole("button", { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // Verify event log was NOT saved (task was already closed)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("task-001", { title: "Updated title" })
      })
      expect(eventLogsCalled).toBe(false)
    })
  })
})
