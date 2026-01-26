import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { SessionLinks } from "./SessionLinks"
import { eventDatabase, type EventLogMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn(),
    listEventLogs: vi.fn(),
    getEventLogsForTask: vi.fn(),
  },
}))

const mockInit = eventDatabase.init as ReturnType<typeof vi.fn>
const mockGetEventLogsForTask = eventDatabase.getEventLogsForTask as ReturnType<typeof vi.fn>

describe("SessionLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInit.mockResolvedValue(undefined)
    mockGetEventLogsForTask.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows loading state while fetching", async () => {
    // Mock to never resolve
    mockGetEventLogsForTask.mockImplementation(
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
    mockGetEventLogsForTask.mockResolvedValue([])

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when no logs match
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when fetch returns an error", async () => {
    mockGetEventLogsForTask.mockRejectedValue(new Error("Database error"))

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing on error
    expect(container.firstChild).toBeNull()
  })

  it("renders session logs for the task", async () => {
    const logsForTask: EventLogMetadata[] = [
      {
        id: "log-001",
        createdAt: new Date("2026-01-23T12:00:00Z").getTime(),
        eventCount: 10,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
      {
        id: "log-002",
        createdAt: new Date("2026-01-22T12:00:00Z").getTime(),
        eventCount: 5,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
    ]
    mockGetEventLogsForTask.mockResolvedValue(logsForTask)

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

  it("navigates to eventlog on click", async () => {
    const logsForTask: EventLogMetadata[] = [
      {
        id: "abcdef12",
        createdAt: new Date("2026-01-23T12:00:00Z").getTime(),
        eventCount: 10,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
    ]
    mockGetEventLogsForTask.mockResolvedValue(logsForTask)

    render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    const user = userEvent.setup()

    // Click on the session link
    const sessionButton = screen.getByRole("button", { name: /view session/i })
    await user.click(sessionButton)

    // Should update the URL hash
    expect(window.location.hash).toBe("#eventlog=abcdef12")
  })

  it("sorts session logs by date, most recent first", async () => {
    const logsForTask: EventLogMetadata[] = [
      {
        id: "log-old",
        createdAt: new Date("2026-01-20T12:00:00Z").getTime(),
        eventCount: 5,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
      {
        id: "log-new",
        createdAt: new Date("2026-01-23T12:00:00Z").getTime(),
        eventCount: 10,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
      {
        id: "log-mid",
        createdAt: new Date("2026-01-21T12:00:00Z").getTime(),
        eventCount: 7,
        taskId: "task-001",
        taskTitle: null,
        source: null,
        workspacePath: null,
      },
    ]
    mockGetEventLogsForTask.mockResolvedValue(logsForTask)

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

  it("renders nothing when eventlogs is empty", async () => {
    mockGetEventLogsForTask.mockResolvedValue([])

    const { container } = render(<SessionLinks taskId="task-001" />)

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    // Component should render nothing when there are no logs
    expect(container.firstChild).toBeNull()
  })
})
