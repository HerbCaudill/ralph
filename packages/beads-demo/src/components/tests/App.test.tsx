import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { App } from "../../App"

// Mock the beads-view hooks
vi.mock("@herbcaudill/beads-view", async () => {
  const actual = await vi.importActual<typeof import("@herbcaudill/beads-view")>(
    "@herbcaudill/beads-view",
  )
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
      state: {
        current: { path: "/test", name: "Test" },
        workspaces: [],
        isLoading: false,
      },
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
        clearTasks: vi.fn(),
        setSelectedTaskId: vi.fn(),
        setAccentColor: vi.fn(),
      }),
    selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
    selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
  }
})

describe("App", () => {
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
})
