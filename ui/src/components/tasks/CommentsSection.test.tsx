import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CommentsSection, type Comment } from "./CommentsSection"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create mock response with proper headers
function createMockResponse(data: object, options?: { ok?: boolean; status?: number }) {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.ok === false ? "Error" : "OK",
    headers: {
      get: (name: string) => (name === "content-type" ? "application/json" : null),
    },
    json: () => Promise.resolve(data),
  }
}

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
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading indicator while fetching", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<CommentsSection taskId="rui-123" />)

      expect(screen.getByText("Loading comments...")).toBeInTheDocument()
    })
  })

  describe("comments display", () => {
    it("displays comments after loading", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: sampleComments }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument()
      })
      expect(screen.getByText("This is a comment")).toBeInTheDocument()
      expect(screen.getByText("Bob")).toBeInTheDocument()
    })

    it("shows no comments message when empty", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("No comments yet")).toBeInTheDocument()
      })
    })

    it("renders markdown in comments", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: sampleComments }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("markdown")).toBeInTheDocument()
      })
      // The word "markdown" should be bold
      const boldElement = screen.getByText("markdown")
      expect(boldElement.tagName).toBe("STRONG")
    })

    it("shows Comments label", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      expect(screen.getByText("Comments")).toBeInTheDocument()
    })
  })

  describe("error handling", () => {
    it("displays error message when fetch fails", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: false, error: "Failed to fetch" }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Failed to fetch")).toBeInTheDocument()
      })
    })

    it("displays error message on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument()
      })
    })

    it("displays error message when response is not JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: {
          get: () => "text/html", // Not JSON
        },
      })

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByText("Server error: 404 Not Found")).toBeInTheDocument()
      })
    })
  })

  describe("read-only mode", () => {
    it("does not show add comment form in read-only mode", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: sampleComments }))

      render(<CommentsSection taskId="rui-123" readOnly />)

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument()
      })

      expect(screen.queryByPlaceholderText("Add a comment...")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Add comment" })).not.toBeInTheDocument()
    })
  })

  describe("adding comments", () => {
    it("shows add comment form when not read-only", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
      })
      expect(screen.getByRole("button", { name: "Add comment" })).toBeInTheDocument()
    })

    it("disables add button when comment is empty", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled()
      })
    })

    it("enables add button when comment has content", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
        target: { value: "New comment" },
      })

      expect(screen.getByRole("button", { name: "Add comment" })).not.toBeDisabled()
    })

    it("submits comment and refreshes list", async () => {
      // First fetch - initial load
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
      })

      // Setup mock for POST and subsequent GET
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }))
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          comments: [
            {
              id: 3,
              issue_id: "rui-123",
              author: "Test User",
              text: "New comment",
              created_at: new Date().toISOString(),
            },
          ],
        }),
      )

      fireEvent.change(screen.getByPlaceholderText("Add a comment..."), {
        target: { value: "New comment" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Add comment" }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-123/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: "New comment" }),
        })
      })

      await waitFor(() => {
        expect(screen.getByText("New comment")).toBeInTheDocument()
      })
    })
  })

  describe("API calls", () => {
    it("fetches comments for the correct task ID", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, comments: [] }))

      render(<CommentsSection taskId="rui-456" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-456/comments")
      })
    })

    it("refetches when taskId changes", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ ok: true, comments: [] }))

      const { rerender } = render(<CommentsSection taskId="rui-123" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-123/comments")
      })

      rerender(<CommentsSection taskId="rui-456" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/tasks/rui-456/comments")
      })
    })
  })
})
