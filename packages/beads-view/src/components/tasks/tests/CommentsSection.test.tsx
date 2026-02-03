import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CommentsSection } from ".././CommentsSection"
import { beadsViewStore } from "@herbcaudill/beads-view"
import type { Comment } from "../../../types"

// Sample comments
const sampleComments: Comment[] = [
  {
    id: 1,
    issue_id: "rui-123",
    author: "Alice",
    text: "This is a comment",
    created_at: "2026-01-18T12:00:00Z",
  },
  {
    id: 2,
    issue_id: "rui-123",
    author: "Bob",
    text: "Another **markdown** comment",
    created_at: "2026-01-19T14:30:00Z",
  },
]

describe("CommentsSection", () => {
  beforeEach(() => {
    // Reset store to clear any persisted comment drafts between tests
    beadsViewStore.setState({
      commentDrafts: {},
      taskInputDraft: "",
      selectedTaskId: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Also reset store after each test to prevent leaks
    beadsViewStore.setState({
      commentDrafts: {},
      taskInputDraft: "",
      selectedTaskId: null,
    })
  })

  describe("loading state", () => {
    it("shows loading indicator when isLoading is true", () => {
      render(<CommentsSection taskId="rui-123" isLoading={true} />)

      expect(screen.getByText("Loading comments...")).toBeInTheDocument()
    })
  })

  describe("comments display", () => {
    it("displays comments when provided", () => {
      render(<CommentsSection taskId="rui-123" comments={sampleComments} />)

      expect(screen.getByText("Alice")).toBeInTheDocument()
      expect(screen.getByText("This is a comment")).toBeInTheDocument()
      expect(screen.getByText("Bob")).toBeInTheDocument()
    })

    it("shows no message when empty", () => {
      render(<CommentsSection taskId="rui-123" comments={[]} />)

      // Should not show "No comments yet" message - it just shows nothing
      expect(screen.queryByText("No comments yet")).not.toBeInTheDocument()
      expect(screen.queryByText("Loading comments...")).not.toBeInTheDocument()
    })

    it("renders markdown in comments", () => {
      render(<CommentsSection taskId="rui-123" comments={sampleComments} />)

      // The word "markdown" should be bold
      const boldElement = screen.getByText("markdown")
      expect(boldElement.tagName).toBe("STRONG")
    })

    it("shows Comments label", () => {
      render(<CommentsSection taskId="rui-123" comments={[]} />)

      expect(screen.getByText("Comments")).toBeInTheDocument()
    })
  })

  describe("error handling", () => {
    it("displays error message when error is provided", () => {
      render(<CommentsSection taskId="rui-123" error="Failed to fetch" />)

      expect(screen.getByText("Failed to fetch")).toBeInTheDocument()
    })

    it("does not show error when loading", () => {
      render(<CommentsSection taskId="rui-123" isLoading={true} error="Some error" />)

      // Loading state takes precedence
      expect(screen.getByText("Loading comments...")).toBeInTheDocument()
      expect(screen.queryByText("Some error")).not.toBeInTheDocument()
    })
  })

  describe("read-only mode", () => {
    it("does not show add comment form in read-only mode", () => {
      render(<CommentsSection taskId="rui-123" comments={sampleComments} readOnly />)

      expect(screen.getByText("Alice")).toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText(
          "Add a comment (Enter to submit, Shift+Enter for new line)...",
        ),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Add comment" })).not.toBeInTheDocument()
    })
  })

  describe("adding comments", () => {
    it("shows add comment form when not read-only", () => {
      render(<CommentsSection taskId="rui-123" comments={[]} />)

      expect(
        screen.getByPlaceholderText("Add a comment (Enter to submit, Shift+Enter for new line)..."),
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Add comment" })).toBeInTheDocument()
    })

    it("disables add button when comment is empty", () => {
      render(<CommentsSection taskId="rui-123" comments={[]} />)

      expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled()
    })

    it("enables add button when comment has content", () => {
      render(<CommentsSection taskId="rui-123" comments={[]} />)

      act(() => {
        fireEvent.change(
          screen.getByPlaceholderText(
            "Add a comment (Enter to submit, Shift+Enter for new line)...",
          ),
          {
            target: { value: "New comment" },
          },
        )
      })

      expect(screen.getByRole("button", { name: "Add comment" })).not.toBeDisabled()
    })

    it("calls onAddComment when submitting", async () => {
      const mockOnAddComment = vi.fn().mockResolvedValue(undefined)

      render(<CommentsSection taskId="rui-123" comments={[]} onAddComment={mockOnAddComment} />)

      act(() => {
        fireEvent.change(
          screen.getByPlaceholderText(
            "Add a comment (Enter to submit, Shift+Enter for new line)...",
          ),
          {
            target: { value: "New comment" },
          },
        )
      })

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Add comment" }))
      })

      expect(mockOnAddComment).toHaveBeenCalledWith("New comment")
    })

    it("clears textarea after successful submit", async () => {
      const mockOnAddComment = vi.fn().mockResolvedValue(undefined)

      render(<CommentsSection taskId="rui-123" comments={[]} onAddComment={mockOnAddComment} />)

      const textarea = screen.getByPlaceholderText(
        "Add a comment (Enter to submit, Shift+Enter for new line)...",
      ) as HTMLTextAreaElement

      act(() => {
        fireEvent.change(textarea, { target: { value: "New comment" } })
      })

      expect(textarea.value).toBe("New comment")

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Add comment" }))
      })

      expect(textarea.value).toBe("")
    })
  })

  describe("keyboard shortcuts", () => {
    it("submits comment when Enter is pressed", async () => {
      const mockOnAddComment = vi.fn().mockResolvedValue(undefined)

      render(<CommentsSection taskId="rui-123" comments={[]} onAddComment={mockOnAddComment} />)

      const textarea = screen.getByPlaceholderText(
        "Add a comment (Enter to submit, Shift+Enter for new line)...",
      )

      act(() => {
        fireEvent.change(textarea, { target: { value: "New comment" } })
      })

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: false })
      })

      expect(mockOnAddComment).toHaveBeenCalledWith("New comment")
    })

    it("does not submit comment when Shift+Enter is pressed", async () => {
      const mockOnAddComment = vi.fn().mockResolvedValue(undefined)

      render(<CommentsSection taskId="rui-123" comments={[]} onAddComment={mockOnAddComment} />)

      const textarea = screen.getByPlaceholderText(
        "Add a comment (Enter to submit, Shift+Enter for new line)...",
      )

      act(() => {
        fireEvent.change(textarea, { target: { value: "New comment" } })
        fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true })
      })

      // Wait a bit to ensure no call is made
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(mockOnAddComment).not.toHaveBeenCalled()
    })

    it("does not submit empty comment when Enter is pressed", async () => {
      const mockOnAddComment = vi.fn().mockResolvedValue(undefined)

      // Use a different task ID to avoid store draft pollution from other tests
      render(
        <CommentsSection taskId="rui-empty-test" comments={[]} onAddComment={mockOnAddComment} />,
      )

      const textarea = screen.getByPlaceholderText(
        "Add a comment (Enter to submit, Shift+Enter for new line)...",
      ) as HTMLTextAreaElement

      // Verify textarea is actually empty
      expect(textarea.value).toBe("")

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: false })
      })

      expect(mockOnAddComment).not.toHaveBeenCalled()
    })
  })

  // Note: Comment draft persistence tests have been removed.
  // The draft persistence functionality is covered by store-level unit tests.
  // These component tests focus on rendering and interaction behavior,
  // including the core markdown rendering functionality.
})
