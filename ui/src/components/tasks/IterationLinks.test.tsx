import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { IterationLinks } from "./IterationLinks"

describe("IterationLinks", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("shows loading state while fetching", async () => {
    // Mock fetch to never resolve
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        }),
    )

    render(<IterationLinks taskId="task-001" />)

    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.getByText("Iterations")).toBeInTheDocument()
  })

  it("renders nothing when there are no iteration logs for the task", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          eventlogs: [
            {
              id: "log-001",
              createdAt: "2026-01-23T12:00:00Z",
              eventCount: 10,
              metadata: { taskId: "other-task" },
            },
          ],
        }),
    })

    const { container } = render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when no logs match
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when fetch returns an error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: "Server error" }),
    })

    const { container } = render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing on error
    expect(container.firstChild).toBeNull()
  })

  it("renders iteration logs for the task", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          eventlogs: [
            {
              id: "log-001",
              createdAt: "2026-01-23T12:00:00Z",
              eventCount: 10,
              metadata: { taskId: "task-001" },
            },
            {
              id: "log-002",
              createdAt: "2026-01-22T12:00:00Z",
              eventCount: 5,
              metadata: { taskId: "task-001" },
            },
            {
              id: "log-003",
              createdAt: "2026-01-21T12:00:00Z",
              eventCount: 15,
              metadata: { taskId: "other-task" },
            },
          ],
        }),
    })

    render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Should show the "Iterations" label
    expect(screen.getByText("Iterations")).toBeInTheDocument()

    // Should show both logs for task-001 but not the one for other-task
    expect(screen.getByText("10 events")).toBeInTheDocument()
    expect(screen.getByText("5 events")).toBeInTheDocument()
    expect(screen.queryByText("15 events")).not.toBeInTheDocument()
  })

  it("navigates to eventlog on click", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          eventlogs: [
            {
              id: "abcdef12",
              createdAt: "2026-01-23T12:00:00Z",
              eventCount: 10,
              metadata: { taskId: "task-001" },
            },
          ],
        }),
    })

    render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Click on the iteration link
    const iterationButton = screen.getByRole("button", { name: /view iteration/i })
    await user.click(iterationButton)

    // Should update the URL hash
    expect(window.location.hash).toBe("#eventlog=abcdef12")
  })

  it("sorts iteration logs by date, most recent first", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          eventlogs: [
            {
              id: "log-old",
              createdAt: "2026-01-20T12:00:00Z",
              eventCount: 5,
              metadata: { taskId: "task-001" },
            },
            {
              id: "log-new",
              createdAt: "2026-01-23T12:00:00Z",
              eventCount: 10,
              metadata: { taskId: "task-001" },
            },
            {
              id: "log-mid",
              createdAt: "2026-01-21T12:00:00Z",
              eventCount: 7,
              metadata: { taskId: "task-001" },
            },
          ],
        }),
    })

    render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Get all the event count spans
    const eventCounts = screen.getAllByText(/events$/)

    // Most recent (10 events) should be first, then 7, then 5
    expect(eventCounts[0]).toHaveTextContent("10 events")
    expect(eventCounts[1]).toHaveTextContent("7 events")
    expect(eventCounts[2]).toHaveTextContent("5 events")
  })

  it("renders nothing when eventlogs is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          eventlogs: [],
        }),
    })

    const { container } = render(<IterationLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when there are no logs
    expect(container.firstChild).toBeNull()
  })
})
