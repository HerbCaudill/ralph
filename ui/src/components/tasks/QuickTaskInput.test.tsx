import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { createRef } from "react"
import { QuickTaskInput, type QuickTaskInputHandle } from "./QuickTaskInput"

// Mock fetch

const mockFetch = vi.fn()

const STORAGE_KEY = "ralph-ui-task-input-draft"

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

// Helper functions

function mockSuccessResponse(issue: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ ok: true, issue }),
  })
}

function mockErrorResponse(error: string, status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ ok: false, error }),
  })
}

function typeInInput(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// Tests

describe("QuickTaskInput", () => {
  describe("rendering", () => {
    it("renders input and button", () => {
      render(<QuickTaskInput />)

      expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument()
    })

    it("renders with custom placeholder", () => {
      render(<QuickTaskInput placeholder="Create issue..." />)

      expect(screen.getByPlaceholderText("Create issue...")).toBeInTheDocument()
    })

    it("renders disabled state", () => {
      render(<QuickTaskInput disabled />)

      expect(screen.getByRole("textbox")).toBeDisabled()
      expect(screen.getByRole("button")).toBeDisabled()
    })

    it("applies custom className", () => {
      const { container } = render(<QuickTaskInput className="custom-class" />)

      expect(container.querySelector("form")).toHaveClass("custom-class")
    })
  })

  describe("input behavior", () => {
    it("updates value on type", () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "New task")

      expect(input).toHaveValue("New task")
    })

    it("disables submit button when input is empty", () => {
      render(<QuickTaskInput />)

      expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled()
    })

    it("disables submit button when input is only whitespace", () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "   ")

      expect(screen.getByRole("button", { name: /add task/i })).toBeDisabled()
    })

    it("enables submit button when input has text", () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "New task")

      expect(screen.getByRole("button", { name: /add task/i })).toBeEnabled()
    })
  })

  describe("form submission", () => {
    it("submits on Enter", async () => {
      const onTaskCreated = vi.fn()
      const mockIssue = { id: "rui-123", title: "New task", status: "open", priority: 2 }
      mockSuccessResponse(mockIssue)

      render(<QuickTaskInput onTaskCreated={onTaskCreated} />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "New task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(onTaskCreated).toHaveBeenCalledWith(mockIssue)
      })
    })

    it("submits on button click", async () => {
      const onTaskCreated = vi.fn()
      const mockIssue = { id: "rui-456", title: "Another task", status: "open", priority: 2 }
      mockSuccessResponse(mockIssue)

      render(<QuickTaskInput onTaskCreated={onTaskCreated} />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Another task")
      fireEvent.click(screen.getByRole("button", { name: /add task/i }))

      await waitFor(() => {
        expect(onTaskCreated).toHaveBeenCalledWith(mockIssue)
      })
    })

    it("clears input after successful submission", async () => {
      mockSuccessResponse({ id: "rui-789", title: "Task", status: "open", priority: 2 })

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(input).toHaveValue("")
      })
    })

    it("keeps input focused after successful submission", async () => {
      mockSuccessResponse({ id: "rui-focus", title: "Task", status: "open", priority: 2 })

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      // Focus the input first (simulating user interaction)
      input.focus()
      expect(document.activeElement).toBe(input)

      typeInInput(input, "Task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(input).toHaveValue("")
      })

      // Input should still be focused after submission
      // Focus is restored via requestAnimationFrame, so we need to wait for it
      await waitFor(() => {
        expect(document.activeElement).toBe(input)
      })
    })

    it("trims whitespace from title", async () => {
      mockSuccessResponse({ id: "rui-abc", title: "Trimmed", status: "open", priority: 2 })

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "  Trimmed  ")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/tasks",
          expect.objectContaining({
            body: JSON.stringify({ title: "Trimmed" }),
          }),
        )
      })
    })

    it("sends correct request to API", async () => {
      mockSuccessResponse({ id: "rui-xyz", title: "My task", status: "open", priority: 2 })

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "My task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "My task" }),
        })
      })
    })

    it("does not submit on Shift+Enter (allows newlines)", async () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "My task")
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true })

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("loading state", () => {
    it("shows loading state while submitting", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValueOnce(pendingPromise)

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add task/i }))
      })

      // Should show loading state
      expect(screen.getByRole("button", { name: /creating task/i })).toBeInTheDocument()
      expect(screen.getByRole("textbox")).toBeDisabled()

      // Clean up
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ ok: true, issue: { id: "test" } }),
        })
      })
    })

    it("prevents double submission", async () => {
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValue(pendingPromise)

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")

      // Try to submit twice
      const form = screen.getByRole("textbox").closest("form")!
      await act(async () => {
        fireEvent.submit(form)
      })
      await act(async () => {
        fireEvent.submit(form)
      })

      // Should only call fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Clean up
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ ok: true, issue: { id: "test" } }),
        })
      })
    })
  })

  describe("error handling", () => {
    it("calls onError on API error", async () => {
      const onError = vi.fn()
      mockErrorResponse("Title is required", 400)

      render(<QuickTaskInput onError={onError} />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith("Title is required")
      })
    })

    it("calls onError on network error", async () => {
      const onError = vi.fn()
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      render(<QuickTaskInput onError={onError} />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith("Network error")
      })
    })

    it("does not clear input on error", async () => {
      mockErrorResponse("Server error")

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "My task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Input should retain value after error
      expect(input).toHaveValue("My task")
    })

    it("re-enables form after error", async () => {
      mockErrorResponse("Server error")

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(input).toBeEnabled()
        expect(screen.getByRole("button", { name: /add task/i })).toBeEnabled()
      })
    })
  })

  describe("imperative handle", () => {
    it("exposes focus method via ref", () => {
      const ref = createRef<QuickTaskInputHandle>()
      render(<QuickTaskInput ref={ref} />)

      const input = screen.getByRole("textbox")

      // Initially not focused
      expect(document.activeElement).not.toBe(input)

      // Call focus via ref
      act(() => {
        ref.current?.focus()
      })

      // Now should be focused
      expect(document.activeElement).toBe(input)
    })
  })

  describe("accessibility", () => {
    it("has accessible input label", () => {
      render(<QuickTaskInput />)

      expect(screen.getByLabelText(/new task title/i)).toBeInTheDocument()
    })

    it("has accessible button label", () => {
      render(<QuickTaskInput />)

      expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument()
    })

    it("updates button label during loading", async () => {
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValueOnce(pendingPromise)

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task")

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add task/i }))
      })

      expect(screen.getByRole("button", { name: /creating task/i })).toBeInTheDocument()

      // Clean up
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ ok: true, issue: { id: "test" } }),
        })
      })
    })
  })

  describe("localStorage persistence", () => {
    it("persists input value to localStorage as user types", () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "My draft task")

      expect(localStorage.getItem(STORAGE_KEY)).toBe("My draft task")
    })

    it("restores input value from localStorage on mount", () => {
      localStorage.setItem(STORAGE_KEY, "Saved draft")

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveValue("Saved draft")
    })

    it("clears localStorage when input is cleared", () => {
      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Some text")
      expect(localStorage.getItem(STORAGE_KEY)).toBe("Some text")

      typeInInput(input, "")
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it("clears localStorage after successful submission", async () => {
      mockSuccessResponse({ id: "rui-ls-1", title: "Task", status: "open", priority: 2 })

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task to submit")
      expect(localStorage.getItem(STORAGE_KEY)).toBe("Task to submit")

      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(input).toHaveValue("")
      })

      // localStorage is cleared by useEffect after render, so we need to wait for it
      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      })
    })

    it("retains localStorage value after failed submission", async () => {
      mockErrorResponse("Server error")

      render(<QuickTaskInput />)

      const input = screen.getByRole("textbox")
      typeInInput(input, "Task that fails")
      fireEvent.keyDown(input, { key: "Enter" })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Value should still be in localStorage
      expect(localStorage.getItem(STORAGE_KEY)).toBe("Task that fails")
    })
  })
})
