import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NewInstanceDialog } from "./NewInstanceDialog"
import { useAppStore } from "@/store"

// Mock fetch
const mockFetch = vi.fn()

describe("NewInstanceDialog", () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)
    useAppStore.getState().reset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          instance: {
            id: "test-instance",
            name: "Test Instance",
            agentName: "Test Agent",
            status: "stopped",
          },
        }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe("rendering", () => {
    it("renders dialog when open", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId("new-instance-dialog")).toBeInTheDocument()
      expect(screen.getByText("New Instance")).toBeInTheDocument()
      expect(
        screen.getByText("Create a new Ralph instance to run tasks concurrently."),
      ).toBeInTheDocument()
    })

    it("does not render dialog when closed", () => {
      render(<NewInstanceDialog open={false} onOpenChange={mockOnOpenChange} />)

      expect(screen.queryByTestId("new-instance-dialog")).not.toBeInTheDocument()
    })

    it("renders name input field", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId("new-instance-name-input")).toBeInTheDocument()
      expect(screen.getByLabelText("Name")).toBeInTheDocument()
    })

    it("renders agent name input field", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId("new-instance-agent-input")).toBeInTheDocument()
      expect(screen.getByLabelText("Agent Name (optional)")).toBeInTheDocument()
    })

    it("renders create and cancel buttons", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId("new-instance-create-button")).toBeInTheDocument()
      expect(screen.getByTestId("new-instance-cancel-button")).toBeInTheDocument()
    })

    it("auto-focuses name input on open", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId("new-instance-name-input")).toHaveFocus()
    })
  })

  describe("form validation", () => {
    it("disables create button when name is empty", () => {
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const createButton = screen.getByTestId("new-instance-create-button")
      expect(createButton).toBeDisabled()
    })

    it("enables create button when name is provided", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      expect(createButton).not.toBeDisabled()
    })

    it("disables create button when name is only whitespace", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "   ") // Whitespace only

      const createButton = screen.getByTestId("new-instance-create-button")
      expect(createButton).toBeDisabled()
    })
  })

  describe("form submission", () => {
    it("calls API to create instance on submit", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"name":"My Instance"'),
        })
      })
    })

    it("uses name as agentName when not provided", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"agentName":"My Instance"'),
        })
      })
    })

    it("uses custom agentName when provided", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const agentInput = screen.getByTestId("new-instance-agent-input")
      await user.type(agentInput, "CustomAgent")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"agentName":"CustomAgent"'),
        })
      })
    })

    it("closes dialog on successful creation", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it("updates store with new instance", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        const state = useAppStore.getState()
        // The instance should exist in the store
        expect(state.instances.size).toBeGreaterThan(1) // default + new
      })
    })

    it("shows error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ ok: false, error: "Server error" }),
      })

      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByTestId("new-instance-error")).toBeInTheDocument()
      })
      expect(screen.getByText("Server error")).toBeInTheDocument()
    })

    it("shows loading state while creating", async () => {
      // Use a promise that we control to ensure loading state is visible
      let resolvePromise: (value: unknown) => void = () => {}
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolvePromise = resolve
          }),
      )

      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const createButton = screen.getByTestId("new-instance-create-button")
      // Use fireEvent instead of userEvent to avoid waiting for state updates
      fireEvent.click(createButton)

      // Button should show "Creating..." and be disabled while in progress
      await waitFor(() => {
        expect(screen.getByText("Creating...")).toBeInTheDocument()
        expect(createButton).toBeDisabled()
      })

      // Resolve the promise to clean up the test
      resolvePromise({
        ok: true,
        json: () => Promise.resolve({ ok: true, instance: {} }),
      })
    })
  })

  describe("cancel behavior", () => {
    it("closes dialog when cancel button is clicked", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const cancelButton = screen.getByTestId("new-instance-cancel-button")
      await user.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("form reset", () => {
    it("resets form when dialog opens", async () => {
      const { rerender } = render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      // Type something in the name input
      const nameInput = screen.getByTestId("new-instance-name-input")
      fireEvent.change(nameInput, { target: { value: "Some value" } })
      expect(nameInput).toHaveValue("Some value")

      // Close and reopen dialog
      rerender(<NewInstanceDialog open={false} onOpenChange={mockOnOpenChange} />)
      rerender(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      // Form should be reset
      expect(screen.getByTestId("new-instance-name-input")).toHaveValue("")
    })
  })

  describe("keyboard navigation", () => {
    it("submits form on Enter in name field", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance{Enter}")

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it("submits form on Enter in agent field", async () => {
      const user = userEvent.setup()
      render(<NewInstanceDialog open={true} onOpenChange={mockOnOpenChange} />)

      const nameInput = screen.getByTestId("new-instance-name-input")
      await user.type(nameInput, "My Instance")

      const agentInput = screen.getByTestId("new-instance-agent-input")
      await user.type(agentInput, "Agent{Enter}")

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })
})
