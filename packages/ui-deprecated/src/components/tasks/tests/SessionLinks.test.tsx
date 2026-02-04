import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { SessionLinks } from ".././SessionLinks"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn(),
    listAllSessions: vi.fn(),
    getSessionsForTask: vi.fn(),
  },
}))

const mockInit = eventDatabase.init as ReturnType<typeof vi.fn>
const mockGetSessionsForTask = eventDatabase.getSessionsForTask as ReturnType<typeof vi.fn>

/** Helper to create SessionMetadata fixtures */
function createSessionMetadata(
  id: string,
  startedAt: number,
  eventCount: number,
  taskId?: string,
): SessionMetadata {
  return {
    id,
    instanceId: "default",
    workspaceId: null,
    startedAt,
    completedAt: null,
    taskId: taskId ?? null,
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: 200000 },
    session: { current: 1, total: 1 },
    eventCount,
    lastEventSequence: eventCount - 1,
  }
}

describe("SessionLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInit.mockResolvedValue(undefined)
    mockGetSessionsForTask.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows loading state while fetching", async () => {
    // Mock to never resolve
    mockGetSessionsForTask.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        }),
    )

    render(<SessionLinks taskId="task-001" />)

    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.getByText("Sessions")).toBeInTheDocument()
  })

  it("renders nothing when there are no session logs for the task", async () => {
    mockGetSessionsForTask.mockResolvedValue([])

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when no logs match
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when fetch returns an error", async () => {
    mockGetSessionsForTask.mockRejectedValue(new Error("Database error"))

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing on error
    expect(container.firstChild).toBeNull()
  })

  it("renders session logs for the task", async () => {
    const sessionsForTask: SessionMetadata[] = [
      createSessionMetadata("log-001", new Date("2026-01-23T12:00:00Z").getTime(), 10, "task-001"),
      createSessionMetadata("log-002", new Date("2026-01-22T12:00:00Z").getTime(), 5, "task-001"),
    ]
    mockGetSessionsForTask.mockResolvedValue(sessionsForTask)

    render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Should show the "Sessions" label
    expect(screen.getByText("Sessions")).toBeInTheDocument()

    // Should show both logs for task-001
    expect(screen.getByText("10 events")).toBeInTheDocument()
    expect(screen.getByText("5 events")).toBeInTheDocument()
  })

  it("navigates to session on click", async () => {
    const sessionsForTask: SessionMetadata[] = [
      createSessionMetadata("abcdef12", new Date("2026-01-23T12:00:00Z").getTime(), 10, "task-001"),
    ]
    mockGetSessionsForTask.mockResolvedValue(sessionsForTask)

    render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Click on the session link
    const sessionButton = screen.getByRole("button", { name: /view session/i })
    await user.click(sessionButton)

    // Should update the URL hash with new session= format
    expect(window.location.hash).toBe("#session=abcdef12")
  })

  it("sorts session logs by date, most recent first", async () => {
    const sessionsForTask: SessionMetadata[] = [
      createSessionMetadata("log-old", new Date("2026-01-20T12:00:00Z").getTime(), 5, "task-001"),
      createSessionMetadata("log-new", new Date("2026-01-23T12:00:00Z").getTime(), 10, "task-001"),
      createSessionMetadata("log-mid", new Date("2026-01-21T12:00:00Z").getTime(), 7, "task-001"),
    ]
    mockGetSessionsForTask.mockResolvedValue(sessionsForTask)

    render(<SessionLinks taskId="task-001" />)

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

  it("renders nothing when sessions is empty", async () => {
    mockGetSessionsForTask.mockResolvedValue([])

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when there are no sessions
    expect(container.firstChild).toBeNull()
  })
})
