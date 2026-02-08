import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { App } from "../../App"
import { DEFAULT_ACCENT_COLOR } from "@herbcaudill/beads-view"

// Store the mock workspace to allow per-test customization
let mockWorkspaceState = {
  current: { path: "/test", name: "Test", accentColor: undefined as string | undefined },
  workspaces: [],
  isLoading: false,
}

// Mock the beads-view hooks
vi.mock("@herbcaudill/beads-view", async () => {
  const actual =
    await vi.importActual<typeof import("@herbcaudill/beads-view")>("@herbcaudill/beads-view")
  return {
    ...actual,
    useTasks: () => ({
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    }),
    useTaskDialog: () => ({
      selectedTask: null,
      openDialogById: vi.fn(),
      closeDialog: vi.fn(),
    }),
    useWorkspace: () => ({
      state: mockWorkspaceState,
      actions: {
        switchWorkspace: vi.fn(),
      },
    }),
    useBeadsHotkeys: () => ({
      registeredHotkeys: [],
    }),
    useBeadsViewStore: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        selectedTaskId: null,
        visibleTaskIds: [],
        tasks: [],
        closedTimeFilter: "past_day",
        clearTasks: vi.fn(),
        setSelectedTaskId: vi.fn(),
        setAccentColor: vi.fn(),
      }),
    selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
    selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
    selectTasks: (state: { tasks: unknown[] }) => state.tasks,
    selectClosedTimeFilter: (state: { closedTimeFilter: string }) => state.closedTimeFilter,
  }
})

describe("App", () => {
  beforeEach(() => {
    // Reset workspace state before each test
    mockWorkspaceState = {
      current: { path: "/test", name: "Test", accentColor: undefined },
      workspaces: [],
      isLoading: false,
    }
    // Clean up any existing --accent-color
    document.documentElement.style.removeProperty("--accent-color")
  })

  afterEach(() => {
    cleanup()
    // Clean up --accent-color after tests
    document.documentElement.style.removeProperty("--accent-color")
  })

  describe("when no task is selected", () => {
    it("shows the quick task input instead of task chat", () => {
      render(<App />)
      // The quick task input should be visible with its placeholder
      expect(screen.getByPlaceholderText("Add a task...")).toBeInTheDocument()
    })

    it("does not show the task chat interface", () => {
      render(<App />)
      // TaskChat displays "Ask me to create or manage tasks." when connected
      expect(screen.queryByText(/Ask me to create or manage tasks/i)).not.toBeInTheDocument()
    })
  })

  describe("accent color", () => {
    it("applies the workspace accent color to the document", () => {
      mockWorkspaceState.current.accentColor = "#ff5500"
      render(<App />)

      const accentColor = document.documentElement.style.getPropertyValue("--accent-color")
      expect(accentColor).toBe("#ff5500")
    })

    it("applies the default accent color when workspace has no accent color", () => {
      mockWorkspaceState.current.accentColor = undefined
      render(<App />)

      const accentColor = document.documentElement.style.getPropertyValue("--accent-color")
      expect(accentColor).toBe(DEFAULT_ACCENT_COLOR)
    })

    it("cleans up accent color when unmounting", () => {
      mockWorkspaceState.current.accentColor = "#ff5500"
      const { unmount } = render(<App />)

      // Verify it's set
      expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ff5500")

      // Unmount and verify cleanup
      unmount()
      expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("")
    })
  })
})
