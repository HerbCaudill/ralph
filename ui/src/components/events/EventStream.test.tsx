import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { EventStream } from "./EventStream"
import { useAppStore } from "@/store"

describe("EventStream", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
  })

  describe("empty state", () => {
    it("shows empty message when no events", () => {
      render(<EventStream />)
      expect(screen.getByText("No events yet")).toBeInTheDocument()
    })

    it("has correct ARIA attributes", () => {
      render(<EventStream />)
      const container = screen.getByRole("log")
      expect(container).toHaveAttribute("aria-label", "Event stream")
      expect(container).toHaveAttribute("aria-live", "polite")
    })
  })

  describe("displaying user messages", () => {
    it("renders user_message events", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Hello, can you help me?",
      })
      render(<EventStream />)
      expect(screen.getByText("Hello, can you help me?")).toBeInTheDocument()
    })

    it("renders multiple user messages", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "First message",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Second message",
      })
      render(<EventStream />)
      expect(screen.getByText("First message")).toBeInTheDocument()
      expect(screen.getByText("Second message")).toBeInTheDocument()
    })
  })

  describe("displaying assistant messages", () => {
    it("renders assistant text content", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "text",
              text: "I can help you with that.",
            },
          ],
        },
      })
      render(<EventStream />)
      expect(screen.getByText("I can help you with that.")).toBeInTheDocument()
    })

    it("renders assistant tool_use content", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      render(<EventStream />)
      expect(screen.getByText("Read")).toBeInTheDocument()
      expect(screen.getByText("/test/file.ts")).toBeInTheDocument()
    })

    it("renders assistant with text and tool_use mixed", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "text",
              text: "Let me read that file.",
            },
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      render(<EventStream />)
      expect(screen.getByText("Let me read that file.")).toBeInTheDocument()
      expect(screen.getByText("Read")).toBeInTheDocument()
    })
  })

  describe("tool results", () => {
    it("shows tool result output when present", () => {
      // Add tool use
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      // Add tool result
      useAppStore.getState().addEvent({
        type: "user",
        timestamp: 1705600001000,
        tool_use_result: "File content",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_123",
              content: "line 1\nline 2\nline 3",
              is_error: false,
            },
          ],
        },
      })
      render(<EventStream />)
      // Should show line count for Read tool
      expect(screen.getByText(/Read 3 lines/)).toBeInTheDocument()
    })
  })

  describe("filtering events", () => {
    it("skips stream_event events (renders nothing visible)", () => {
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: 1705600000000,
        event: { type: "content_block_delta" },
      })
      render(<EventStream />)
      // Stream events render nothing, but the container has events so empty state doesn't show
      const container = screen.getByRole("log")
      // Should have no visible content (just the container)
      expect(container.textContent?.trim()).toBe("")
    })

    it("skips system events (renders nothing visible)", () => {
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      render(<EventStream />)
      // System events render nothing
      const container = screen.getByRole("log")
      expect(container.textContent?.trim()).toBe("")
    })
  })

  describe("maxEvents limit", () => {
    it("limits displayed events to maxEvents", () => {
      // Add 5 user messages
      for (let i = 0; i < 5; i++) {
        useAppStore.getState().addEvent({
          type: "user_message",
          timestamp: 1705600000000 + i * 1000,
          message: `Message ${i}`,
        })
      }
      render(<EventStream maxEvents={3} />)
      // Should only show the last 3 messages
      expect(screen.queryByText("Message 0")).not.toBeInTheDocument()
      expect(screen.queryByText("Message 1")).not.toBeInTheDocument()
      expect(screen.getByText("Message 2")).toBeInTheDocument()
      expect(screen.getByText("Message 3")).toBeInTheDocument()
      expect(screen.getByText("Message 4")).toBeInTheDocument()
    })
  })

  describe("scroll to bottom button", () => {
    it("does not show scroll to bottom button initially", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      render(<EventStream />)
      expect(screen.queryByLabelText("Scroll to latest events")).not.toBeInTheDocument()
    })

    it("shows scroll to bottom button when scrolled up", () => {
      // Add many events to make scrolling possible
      for (let i = 0; i < 100; i++) {
        useAppStore.getState().addEvent({
          type: "user_message",
          timestamp: 1705600000000 + i * 1000,
          message: `Message ${i}`,
        })
      }
      render(<EventStream />)

      // Get the scroll container
      const container = screen.getByRole("log")

      // Mock scroll position to simulate being scrolled up
      Object.defineProperty(container, "scrollHeight", { value: 2000 })
      Object.defineProperty(container, "scrollTop", { value: 0 })
      Object.defineProperty(container, "clientHeight", { value: 500 })

      // Trigger wheel event (user scrolling)
      fireEvent.wheel(container)
      // Trigger scroll event
      fireEvent.scroll(container)

      // Now the button should appear
      expect(screen.getByLabelText("Scroll to latest events")).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = render(<EventStream className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("running spinner", () => {
    it("shows spinner when Ralph is running", () => {
      useAppStore.getState().setRalphStatus("running")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      render(<EventStream />)
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
      expect(screen.getByLabelText("Ralph is running")).toBeInTheDocument()
    })

    it("shows spinner when Ralph is starting", () => {
      useAppStore.getState().setRalphStatus("starting")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      render(<EventStream />)
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
    })

    it("does not show spinner when Ralph is stopped", () => {
      useAppStore.getState().setRalphStatus("stopped")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      render(<EventStream />)
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("does not show spinner when Ralph is paused", () => {
      useAppStore.getState().setRalphStatus("paused")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      render(<EventStream />)
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("does not show spinner when there are no events (empty state)", () => {
      useAppStore.getState().setRalphStatus("running")
      render(<EventStream />)
      // Empty state shows "No events yet" instead
      expect(screen.getByText("No events yet")).toBeInTheDocument()
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })
  })
})
