import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react"
import { TaskDetailsDialog } from "./TaskDetailsDialog"
import { useAppStore } from "@/store"
import type { TaskCardTask } from "@/types"

// Mock child components to avoid their async behavior
vi.mock("./RelatedTasks", () => ({
  RelatedTasks: () => null,
}))

vi.mock("./CommentsSection", () => ({
  CommentsSection: () => null,
}))

// Helper functions

function typeInInput(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// Helper to render and wait for async operations to complete
async function renderAndWait(ui: React.ReactElement) {
  const result = render(ui)
  // Wait for labels fetch to complete (triggered by useEffect)
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return result
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
        json: () => Promise.resolve({ ok: true, comments: [] }),
      })
    }
    // Handle task fetch (used by RelatedTasks component)
    if (typeof url === "string" && url.match(/\/api\/tasks\/[^/]+$/)) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, issue: { dependencies: [], dependents: [] } }),
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
    it("renders task details when open", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("test-123")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()
      // Description is rendered as markdown in click-to-edit mode
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("does not render when task is null", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={null} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("does not render when open is false", async () => {
      await renderAndWait(
        <TaskDetailsDialog
          task={mockTask}
          open={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("shows task ID in header", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("test-123")).toBeInTheDocument()
    })

    it("shows task type and parent in dialog", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Type selector shows "Task" (capitalized)
      expect(screen.getByText("Task")).toBeInTheDocument()
      expect(screen.getByText("parent-456")).toBeInTheDocument()
    })

    it("shows type selector with task default when no type is set", async () => {
      const taskWithoutMetadata: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      await renderAndWait(
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
    it("displays values as text instead of inputs when readOnly", async () => {
      await renderAndWait(
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

    it("does not show Done button in read-only mode", async () => {
      await renderAndWait(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument()
    })
  })

  describe("editing", () => {
    it("allows editing title", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByDisplayValue("Test Task")
      typeInInput(titleInput, "Updated Title")

      expect(titleInput).toHaveValue("Updated Title")
    })

    it("allows editing description via click-to-edit", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Description is initially shown as text, click to edit
      const descriptionText = screen.getByText("This is a test description")
      act(() => {
        fireEvent.click(descriptionText)
      })

      // Now the textarea should appear (it's a plain textarea now, not with aria-label)
      const descInput = await screen.findByPlaceholderText("Add description...")
      typeInInput(descInput, "Updated description")

      expect(descInput).toHaveValue("Updated description")
    })

    it("autosaves title after debounce", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByDisplayValue("Test Task")
      typeInInput(titleInput, "New Title")

      // Should not have saved immediately
      expect(mockOnSave).not.toHaveBeenCalled()

      // Wait for debounced save to complete
      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "New Title" })
        },
        { timeout: 1000 },
      )
    })

    it("autosaves type immediately when changed", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Find and click the "Bug" button in the type button bar
      const bugButton = screen.getByRole("button", { name: /bug/i })
      await act(async () => {
        fireEvent.click(bugButton)
      })

      // Should save immediately (no debounce for non-text fields)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { type: "bug" })
      })
    })

    it("autosaves parent immediately when changed", async () => {
      // Set up tasks in store
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open", parent: "parent-456" },
          { id: "parent-456", title: "Parent Task", status: "open" },
          { id: "other-789", title: "Other Task", status: "open" },
        ],
      })

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent combobox
      const parentCombobox = screen.getByRole("combobox", { name: /parent/i })
      act(() => {
        fireEvent.click(parentCombobox)
      })

      // Select "Other Task" from the dropdown
      await waitFor(() => {
        expect(screen.getByText("other-789")).toBeInTheDocument()
      })
      await act(async () => {
        const otherOption = screen.getByText("other-789").closest("[cmdk-item]")
        if (otherOption) {
          fireEvent.click(otherOption)
        }
      })

      // Should autosave immediately
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { parent: "other-789" })
      })
    })

    it("autosaves when clearing parent by selecting None", async () => {
      // Set up tasks in store
      useAppStore.setState({
        tasks: [
          { id: "test-123", title: "Test Task", status: "open", parent: "parent-456" },
          { id: "parent-456", title: "Parent Task", status: "open" },
        ],
      })

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent combobox
      const parentCombobox = screen.getByRole("combobox", { name: /parent/i })
      act(() => {
        fireEvent.click(parentCombobox)
      })

      // Select "None" from the dropdown - find inside the popover content
      await waitFor(() => {
        // The "None" option is inside the command list
        const noneOptions = screen.getAllByText("None")
        // Get the one inside the cmdk list (not the button trigger)
        const noneInList = noneOptions.find(el => el.closest("[cmdk-item]"))
        expect(noneInList).toBeInTheDocument()
      })
      await act(async () => {
        const noneOptions = screen.getAllByText("None")
        const noneInList = noneOptions.find(el => el.closest("[cmdk-item]"))
        if (noneInList) {
          const noneItem = noneInList.closest("[cmdk-item]")
          if (noneItem) {
            fireEvent.click(noneItem)
          }
        }
      })

      // Should autosave immediately
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { parent: null })
      })
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

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the parent combobox
      const parentCombobox = screen.getByRole("combobox", { name: /parent/i })
      act(() => {
        fireEvent.click(parentCombobox)
      })

      // Valid parent should be in the dropdown
      await waitFor(() => {
        expect(screen.getByText("valid-parent")).toBeInTheDocument()
      })

      // Self should not be in the dropdown (test-123 with "Test Task" title)
      // The trigger shows "None" initially, but inside the list there should be no test-123 option
      const testTaskItems = screen.queryAllByText("test-123")
      const testTaskInList = testTaskItems.filter(el => el.closest("[cmdk-item]"))
      expect(testTaskInList.length).toBe(0)

      // Child (which has test-123 as parent) should not be in the dropdown
      // Note: The child task ID may appear elsewhere in the document (e.g., in RelatedTasks)
      // so we specifically check that it's not in the command list
      const childTaskItems = screen.queryAllByText("child-task")
      const childTaskInList = childTaskItems.filter(el => el.closest("[cmdk-item]"))
      expect(childTaskInList.length).toBe(0)
    })
  })

  describe("autosave", () => {
    it("only includes changed fields in autosave payload", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByDisplayValue("Test Task")
      typeInInput(titleInput, "Updated Title")

      // Wait for debounced save to complete
      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { title: "Updated Title" })
        },
        { timeout: 1000 },
      )
    })

    it("shows saving indicator during autosave", async () => {
      let resolvePromise: () => void = () => {}
      mockOnSave.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolvePromise = resolve
          }),
      )

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Change type to trigger immediate autosave
      const bugButton = screen.getByRole("button", { name: /bug/i })
      await act(async () => {
        fireEvent.click(bugButton)
      })

      expect(screen.getByText(/saving/i)).toBeInTheDocument()

      await act(async () => {
        resolvePromise()
      })

      await waitFor(() => {
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument()
      })
    })
  })

  describe("closing", () => {
    it("calls onClose when Done is clicked", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const doneButton = screen.getByRole("button", { name: /done/i })
      await act(async () => {
        fireEvent.click(doneButton)
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it("calls onClose when X button is clicked", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const closeButton = screen.getByRole("button", { name: /close/i })
      await act(async () => {
        fireEvent.click(closeButton)
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe("state reset", () => {
    it("resets form when task changes", async () => {
      const { rerender } = await renderAndWait(
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

      await act(async () => {
        rerender(
          <TaskDetailsDialog
            task={newTask}
            open={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />,
        )
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(screen.getByDisplayValue("New Task")).toBeInTheDocument()
      // Description is rendered as markdown in click-to-edit mode
      expect(screen.getByText("New description")).toBeInTheDocument()
    })
  })

  describe("click-to-edit description", () => {
    it("shows description as markdown text by default", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Description should be rendered as text, not as a textarea
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: /description/i })).not.toBeInTheDocument()
    })

    it("shows placeholder text when description is empty", async () => {
      const taskWithoutDescription: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      await renderAndWait(
        <TaskDetailsDialog
          task={taskWithoutDescription}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      expect(screen.getByText("Add description...")).toBeInTheDocument()
    })

    it("switches to edit mode when description is clicked", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description
      act(() => {
        fireEvent.click(screen.getByText("This is a test description"))
      })

      // Now the textarea should appear
      const descInput = await screen.findByPlaceholderText("Add description...")
      expect(descInput).toBeInTheDocument()
      expect(descInput).toHaveValue("This is a test description")
    })

    it("exits edit mode on blur", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      act(() => {
        fireEvent.click(screen.getByText("This is a test description"))
      })

      const descInput = await screen.findByPlaceholderText("Add description...")
      expect(descInput).toBeInTheDocument()

      // Blur the textarea
      act(() => {
        fireEvent.blur(descInput)
      })

      // Should exit edit mode and show text again
      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Add description...")).not.toBeInTheDocument()
      })
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("reverts changes on Escape key", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      act(() => {
        fireEvent.click(screen.getByText("This is a test description"))
      })

      const descInput = await screen.findByPlaceholderText("Add description...")
      typeInInput(descInput, "Changed description")
      expect(descInput).toHaveValue("Changed description")

      // Press Escape
      act(() => {
        fireEvent.keyDown(descInput, { key: "Escape" })
      })

      // Should exit edit mode and show original text
      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Add description...")).not.toBeInTheDocument()
      })
      expect(screen.getByText("This is a test description")).toBeInTheDocument()
    })

    it("preserves changes on blur and triggers autosave", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      act(() => {
        fireEvent.click(screen.getByText("This is a test description"))
      })

      const descInput = await screen.findByPlaceholderText("Add description...")
      typeInInput(descInput, "Updated description")

      // Blur the textarea
      act(() => {
        fireEvent.blur(descInput)
      })

      // Should exit edit mode and show updated text
      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Add description...")).not.toBeInTheDocument()
      })
      expect(screen.getByText("Updated description")).toBeInTheDocument()

      // Should trigger autosave (description autosaves after debounce)
      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, {
            description: "Updated description",
          })
        },
        { timeout: 1000 },
      )
    })

    it("shows nothing in read-only mode when description is empty", async () => {
      const taskWithoutDescription: TaskCardTask = {
        id: "test-123",
        title: "Test Task",
        status: "open",
      }

      await renderAndWait(
        <TaskDetailsDialog
          task={taskWithoutDescription}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Should not show "No description" or "Add description..." in read-only mode
      expect(screen.queryByText("No description")).not.toBeInTheDocument()
      expect(screen.queryByText("Add description...")).not.toBeInTheDocument()
    })
  })

  describe("keyboard shortcuts", () => {
    it("closes on Cmd+Enter (Mac)", async () => {
      // Mock Mac platform
      const originalPlatform = navigator.platform
      Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true })

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Press Cmd+Enter
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", metaKey: true })
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })

      // Restore platform
      Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true })
    })

    it("closes on Ctrl+Enter (Windows/Linux)", async () => {
      // Mock Windows platform
      const originalPlatform = navigator.platform
      Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true })

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Press Ctrl+Enter
      await act(async () => {
        fireEvent.keyDown(window, { key: "Enter", ctrlKey: true })
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })

      // Restore platform
      Object.defineProperty(navigator, "platform", { value: originalPlatform, configurable: true })
    })

    it("does not close on Cmd+Enter in read-only mode", async () => {
      await renderAndWait(
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

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it("closes on Escape key", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Press Escape
      await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" })
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it("closes on Escape key in read-only mode", async () => {
      await renderAndWait(
        <TaskDetailsDialog
          task={mockTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          readOnly={true}
        />,
      )

      // Press Escape
      await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" })
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it("does not close on Escape when focus is in title input", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const titleInput = screen.getByDisplayValue("Test Task")

      // Press Escape while focused on input
      await act(async () => {
        fireEvent.keyDown(titleInput, { key: "Escape" })
      })

      // Should NOT close because focus is in an input
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it("does not close on Escape when focus is in description textarea", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Click on the description to enter edit mode
      act(() => {
        fireEvent.click(screen.getByText("This is a test description"))
      })

      const descInput = await screen.findByPlaceholderText("Add description...")

      // Press Escape while focused on textarea
      await act(async () => {
        fireEvent.keyDown(descInput, { key: "Escape" })
      })

      // Should NOT close because focus is in a textarea (it should exit edit mode instead)
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe("labels", () => {
    it("shows labels section with 'No labels' when task has no labels", async () => {
      await renderAndWait(
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

      await renderAndWait(
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

    it("shows Add label button when not in read-only mode", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      expect(screen.getByText("Add label")).toBeInTheDocument()
    })

    it("does not show Add label button in read-only mode", async () => {
      await renderAndWait(
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
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      const addButton = screen.getByText("Add label")
      act(() => {
        fireEvent.click(addButton)
      })

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

      await renderAndWait(
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

  describe("keyboard navigation", () => {
    it("allows tab navigation between fields", async () => {
      globalThis.fetch = createMockFetch()

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Get all focusable elements in the expected tab order
      const titleInput = screen.getByDisplayValue("Test Task")
      const statusSelect = screen.getByRole("combobox", { name: /status/i })

      // Get the priority buttons - the selected one (P2) should be tabbable
      const selectedPriorityButton = screen.getByRole("button", { pressed: true, name: /p2/i })

      // Get the type buttons - the selected one (Task) should be tabbable
      const selectedTypeButton = screen.getByRole("button", { pressed: true, name: /task/i })
      const parentButton = screen.getByRole("combobox", { name: /parent/i })

      // Verify title is focusable
      titleInput.focus()
      expect(document.activeElement).toBe(titleInput)

      // Tab to status
      fireEvent.keyDown(titleInput, { key: "Tab" })
      // Note: actual tab navigation is handled by the browser, we're just checking elements are tabbable

      // Verify all interactive elements have appropriate tabIndex
      expect(titleInput).not.toHaveAttribute("tabindex", "-1")
      expect(statusSelect).not.toHaveAttribute("tabindex", "-1")
      // Only the selected priority button should be tabbable (tabindex 0)
      expect(selectedPriorityButton).toHaveAttribute("tabindex", "0")
      // Only the selected type button should be tabbable (tabindex 0)
      expect(selectedTypeButton).toHaveAttribute("tabindex", "0")
      expect(parentButton).not.toHaveAttribute("tabindex", "-1")
    })

    it("allows arrow key navigation within type button group", async () => {
      globalThis.fetch = createMockFetch()

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Get the type buttons
      const taskButton = screen
        .getAllByRole("button")
        .find(
          btn => btn.textContent?.includes("Task") && btn.getAttribute("aria-pressed") === "true",
        )
      expect(taskButton).toBeInTheDocument()

      // Press ArrowRight to move to Bug
      fireEvent.keyDown(taskButton!, { key: "ArrowRight" })

      // Wait for state update
      await waitFor(() => {
        const bugButton = screen
          .getAllByRole("button")
          .find(
            btn => btn.textContent?.includes("Bug") && btn.getAttribute("aria-pressed") === "true",
          )
        expect(bugButton).toBeInTheDocument()
      })

      // Press ArrowLeft to move back to Task
      const bugButton = screen
        .getAllByRole("button")
        .find(
          btn => btn.textContent?.includes("Bug") && btn.getAttribute("aria-pressed") === "true",
        )
      fireEvent.keyDown(bugButton!, { key: "ArrowLeft" })

      await waitFor(() => {
        const taskButton = screen
          .getAllByRole("button")
          .find(
            btn => btn.textContent?.includes("Task") && btn.getAttribute("aria-pressed") === "true",
          )
        expect(taskButton).toBeInTheDocument()
      })
    })

    it("allows arrow key navigation within priority button group", async () => {
      globalThis.fetch = createMockFetch()

      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Get the priority buttons - P2 is selected by default (mockTask has priority: 2)
      const p2Button = screen
        .getAllByRole("button")
        .find(btn => btn.textContent?.includes("P2") && btn.getAttribute("aria-pressed") === "true")
      expect(p2Button).toBeInTheDocument()

      // Press ArrowRight to move to P3
      fireEvent.keyDown(p2Button!, { key: "ArrowRight" })

      // Wait for state update
      await waitFor(() => {
        const p3Button = screen
          .getAllByRole("button")
          .find(
            btn => btn.textContent?.includes("P3") && btn.getAttribute("aria-pressed") === "true",
          )
        expect(p3Button).toBeInTheDocument()
      })

      // Press ArrowLeft to move back to P2
      const p3Button = screen
        .getAllByRole("button")
        .find(btn => btn.textContent?.includes("P3") && btn.getAttribute("aria-pressed") === "true")
      fireEvent.keyDown(p3Button!, { key: "ArrowLeft" })

      await waitFor(() => {
        const p2Button = screen
          .getAllByRole("button")
          .find(
            btn => btn.textContent?.includes("P2") && btn.getAttribute("aria-pressed") === "true",
          )
        expect(p2Button).toBeInTheDocument()
      })
    })
  })

  describe("priority button group", () => {
    it("autosaves priority immediately when changed", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Find and click the "P1" button in the priority button bar
      const p1Button = screen.getByRole("button", { name: /p1/i })
      await act(async () => {
        fireEvent.click(p1Button)
      })

      // Should save immediately (no debounce for non-text fields)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockTask.id, { priority: 1 })
      })
    })

    it("displays all priority options as buttons", async () => {
      await renderAndWait(
        <TaskDetailsDialog task={mockTask} open={true} onClose={mockOnClose} onSave={mockOnSave} />,
      )

      // Check all priority buttons are present
      expect(screen.getByRole("button", { name: /p0/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /p1/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /p2/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /p3/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /p4/i })).toBeInTheDocument()
    })

    it("shows correct priority as selected", async () => {
      const highPriorityTask: TaskCardTask = {
        ...mockTask,
        priority: 1,
      }

      await renderAndWait(
        <TaskDetailsDialog
          task={highPriorityTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      // P1 should be selected
      const p1Button = screen.getByRole("button", { name: /p1/i })
      expect(p1Button).toHaveAttribute("aria-pressed", "true")

      // Other priority buttons should not be selected
      const p2Button = screen.getByRole("button", { name: /p2/i })
      expect(p2Button).toHaveAttribute("aria-pressed", "false")
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

      await renderAndWait(
        <TaskDetailsDialog
          task={closedTask}
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
      )

      // Change the title (not the status)
      const titleInput = screen.getByDisplayValue("Already closed task")
      typeInInput(titleInput, "Updated title")

      // Wait for debounced autosave
      await waitFor(
        () => {
          expect(mockOnSave).toHaveBeenCalledWith("task-001", { title: "Updated title" })
        },
        { timeout: 1000 },
      )

      // Verify event log was NOT saved (task was already closed)
      expect(eventLogsCalled).toBe(false)
    })
  })
})
