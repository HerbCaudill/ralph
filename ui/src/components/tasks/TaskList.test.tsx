import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskList, type TaskGroup } from "./TaskList"
import type { TaskCardTask } from "./TaskCard"
import { useAppStore } from "@/store"

const STORAGE_KEY = "ralph-ui-task-list-collapsed-state"
const CLOSED_FILTER_STORAGE_KEY = "ralph-ui-task-list-closed-filter"

// Helper to get recent date (for closed tasks to be visible with default filter)
const getRecentDate = () => new Date().toISOString()

// Test Fixtures

const sampleTasks: TaskCardTask[] = [
  { id: "task-1", title: "Open task 1", status: "open", priority: 2 },
  { id: "task-2", title: "Open task 2", status: "open", priority: 1 },
  { id: "task-3", title: "In progress task", status: "in_progress", priority: 2 },
  { id: "task-4", title: "Blocked task", status: "blocked", priority: 0 },
  {
    id: "task-5",
    title: "Deferred task",
    status: "deferred",
    priority: 3,
    closed_at: getRecentDate(),
  },
  { id: "task-6", title: "Closed task", status: "closed", priority: 2, closed_at: getRecentDate() },
]

// Tests

describe("TaskList", () => {
  describe("rendering", () => {
    it("renders task list container", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByRole("list", { name: "Task list" })).toBeInTheDocument()
    })

    it("renders all group headers", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByLabelText(/Blocked section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Ready section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/In progress section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Closed section/)).toBeInTheDocument()
    })

    it("displays correct task counts in headers", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByLabelText("Blocked section, 1 task")).toBeInTheDocument()
      expect(screen.getByLabelText("Ready section, 2 tasks")).toBeInTheDocument()
      expect(screen.getByLabelText("In progress section, 1 task")).toBeInTheDocument()
      expect(screen.getByLabelText("Closed section, 2 tasks")).toBeInTheDocument()
    })

    it("renders tasks within groups", () => {
      // Override defaults to expand all groups for this test
      render(
        <TaskList
          tasks={sampleTasks}
          defaultCollapsed={{ blocked: false, ready: false, in_progress: false, closed: false }}
        />,
      )
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
      expect(screen.getByText("Open task 2")).toBeInTheDocument()
      expect(screen.getByText("In progress task")).toBeInTheDocument()
      expect(screen.getByText("Blocked task")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      render(<TaskList tasks={sampleTasks} className="custom-class" />)
      expect(screen.getByRole("list")).toHaveClass("custom-class")
    })
  })

  describe("empty state", () => {
    it("shows no tasks message when empty", () => {
      render(<TaskList tasks={[]} />)
      expect(screen.getByRole("status", { name: "No tasks" })).toBeInTheDocument()
      expect(screen.getByText("No tasks")).toBeInTheDocument()
    })

    it("hides empty groups by default", () => {
      const tasksOnlyOpen: TaskCardTask[] = [{ id: "task-1", title: "Open task", status: "open" }]
      render(<TaskList tasks={tasksOnlyOpen} />)

      expect(screen.getByLabelText(/Ready section/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/In progress section/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Blocked section/)).not.toBeInTheDocument()
    })

    it("shows empty groups when showEmptyGroups is true", () => {
      const tasksOnlyOpen: TaskCardTask[] = [{ id: "task-1", title: "Open task", status: "open" }]
      render(<TaskList tasks={tasksOnlyOpen} showEmptyGroups />)

      expect(screen.getByLabelText(/Ready section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/In progress section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Blocked section/)).toBeInTheDocument()
    })

    it("shows empty message within empty groups", () => {
      const tasksOnlyOpen: TaskCardTask[] = [{ id: "task-1", title: "Open task", status: "open" }]
      render(<TaskList tasks={tasksOnlyOpen} showEmptyGroups />)

      // In Progress group should show "No tasks in this group"
      expect(screen.getAllByText("No tasks in this group").length).toBeGreaterThan(0)
    })
  })

  describe("grouping", () => {
    it("groups open tasks under Ready", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Open task", status: "open" },
        { id: "task-2", title: "Another open", status: "open" },
      ]
      render(<TaskList tasks={tasks} />)

      const readyHeader = screen.getByLabelText("Ready section, 2 tasks")
      expect(readyHeader).toBeInTheDocument()
    })

    it("groups in_progress tasks under In progress", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Working on it", status: "in_progress" },
      ]
      render(<TaskList tasks={tasks} />)

      const header = screen.getByLabelText("In progress section, 1 task")
      expect(header).toBeInTheDocument()
    })

    it("groups blocked tasks under Blocked", () => {
      const tasks: TaskCardTask[] = [{ id: "task-1", title: "Stuck task", status: "blocked" }]
      render(<TaskList tasks={tasks} />)

      const header = screen.getByLabelText("Blocked section, 1 task")
      expect(header).toBeInTheDocument()
    })

    it("groups deferred and closed tasks under Closed", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Deferred task", status: "deferred", closed_at: getRecentDate() },
        { id: "task-2", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} />)

      const header = screen.getByLabelText("Closed section, 2 tasks")
      expect(header).toBeInTheDocument()
    })
  })

  describe("sorting", () => {
    it("sorts tasks within groups by priority (ascending)", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-low", title: "Low priority", status: "open", priority: 4 },
        { id: "task-high", title: "High priority", status: "open", priority: 0 },
        { id: "task-med", title: "Medium priority", status: "open", priority: 2 },
      ]
      render(<TaskList tasks={tasks} />)

      // Get task titles in order - they should be sorted by priority
      const taskTitles = screen.getAllByText(/priority/).map(el => el.textContent)
      expect(taskTitles).toEqual(["High priority", "Medium priority", "Low priority"])
    })

    it("treats undefined priority as lowest", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-none", title: "No priority", status: "open" },
        { id: "task-high", title: "High priority", status: "open", priority: 0 },
      ]
      render(<TaskList tasks={tasks} />)

      // Get task titles in order - undefined priority should sort after defined priorities
      const taskTitles = screen.getAllByText(/priority/).map(el => el.textContent)
      expect(taskTitles).toEqual(["High priority", "No priority"])
    })

    it("uses created_at as secondary sort within same priority (oldest first)", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "task-newer",
          title: "Task B created later",
          status: "open",
          priority: 2,
          created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
        {
          id: "task-older",
          title: "Task A created earlier",
          status: "open",
          priority: 2,
          created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
        {
          id: "task-middle",
          title: "Task C created middle",
          status: "open",
          priority: 2,
          created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
      ]
      render(<TaskList tasks={tasks} />)

      // Get task titles in order - they should be sorted by created_at (oldest first) within same priority
      const taskTitles = screen.getAllByText(/Task [ABC] created/).map(el => el.textContent)
      expect(taskTitles).toEqual([
        "Task A created earlier",
        "Task C created middle",
        "Task B created later",
      ])
    })

    it("prioritizes priority over created_at", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "task-low-old",
          title: "Low priority old",
          status: "open",
          priority: 3,
          created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago (older)
        },
        {
          id: "task-high-new",
          title: "High priority new",
          status: "open",
          priority: 1,
          created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (newer)
        },
      ]
      render(<TaskList tasks={tasks} />)

      // High priority should come first regardless of created_at
      const taskTitles = screen.getAllByText(/priority/).map(el => el.textContent)
      expect(taskTitles).toEqual(["High priority new", "Low priority old"])
    })

    it("treats undefined created_at as oldest for secondary sort", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "task-with-date",
          title: "Has create date",
          status: "open",
          priority: 2,
          created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "task-no-date",
          title: "No create date",
          status: "open",
          priority: 2,
          // no created_at
        },
      ]
      render(<TaskList tasks={tasks} />)

      // Task without created_at should be treated as oldest (epoch 0) and come first
      const taskTitles = screen.getAllByText(/date/).map(el => el.textContent)
      expect(taskTitles).toEqual(["No create date", "Has create date"])
    })

    it("sorts closed tasks by closed_at (most recent first)", () => {
      // Use recent dates to ensure they pass the time filter
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "task-old",
          title: "Task A closed earlier",
          status: "closed",
          priority: 0, // Highest priority but should come last
          closed_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
        {
          id: "task-new",
          title: "Task B closed later",
          status: "closed",
          priority: 4, // Lowest priority but should come first
          closed_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
        {
          id: "task-mid",
          title: "Task C closed middle",
          status: "closed",
          priority: 2,
          closed_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
      ]
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Get task titles in order - they should be sorted by closed_at (most recent first)
      const taskTitles = screen.getAllByText(/Task [ABC] closed/).map(el => el.textContent)
      expect(taskTitles).toEqual([
        "Task B closed later",
        "Task C closed middle",
        "Task A closed earlier",
      ])
    })

    it("treats undefined closed_at as oldest for closed tasks", () => {
      // Need to set all_time filter to see task without closed_at
      useAppStore.getState().setClosedTimeFilter("all_time")

      const tasks: TaskCardTask[] = [
        {
          id: "task-no-date",
          title: "No close date",
          status: "closed",
        },
        {
          id: "task-with-date",
          title: "Has close date",
          status: "closed",
          closed_at: getRecentDate(),
        },
      ]
      render(<TaskList tasks={tasks} defaultCollapsed={{ closed: false }} />)

      // Task with closed_at should come first, undefined should be last
      const taskTitles = screen
        .getAllByText(/close|date/i)
        .filter(el => el.textContent?.includes("date"))
        .map(el => el.textContent)
      expect(taskTitles).toEqual(["Has close date", "No close date"])

      // Reset to default
      useAppStore.getState().setClosedTimeFilter("past_day")
    })
  })

  describe("collapse/expand", () => {
    it("expands Ready group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      // Tasks should be visible
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
    })

    it("expands In Progress group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      expect(screen.getByText("In progress task")).toBeInTheDocument()
    })

    it("collapses Blocked group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      // Blocked tasks should not be visible when collapsed
      expect(screen.queryByText("Blocked task")).not.toBeInTheDocument()
    })

    it("collapses Closed group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      // Closed group (deferred/closed) tasks should not be visible
      expect(screen.queryByText("Deferred task")).not.toBeInTheDocument()
      expect(screen.queryByText("Closed task")).not.toBeInTheDocument()
    })

    it("toggles group on header click", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const readyHeader = screen.getByLabelText(/Ready section/)

      // Initially expanded, tasks visible
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(readyHeader)
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()

      // Click to expand again
      fireEvent.click(readyHeader)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
    })

    it("toggles group on Enter key", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const readyHeader = screen.getByLabelText(/Ready section/)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      fireEvent.keyDown(readyHeader, { key: "Enter" })
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })

    it("toggles group on Space key", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const readyHeader = screen.getByLabelText(/Ready section/)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      fireEvent.keyDown(readyHeader, { key: " " })
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })

    it("respects defaultCollapsed prop", () => {
      const defaultCollapsed: Partial<Record<TaskGroup, boolean>> = {
        ready: true,
        in_progress: false,
        closed: false,
      }
      // Use sample tasks with recent closed_at dates
      const tasksWithRecentClosed = sampleTasks.map(t =>
        t.status === "deferred" || t.status === "closed" ? { ...t, closed_at: getRecentDate() } : t,
      )
      render(<TaskList tasks={tasksWithRecentClosed} defaultCollapsed={defaultCollapsed} />)

      // Ready should be collapsed
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()

      // In Progress should be expanded
      expect(screen.getByText("In progress task")).toBeInTheDocument()

      // Closed should be expanded (overriding default behavior)
      expect(screen.getByText("Deferred task")).toBeInTheDocument()
    })

    it("updates aria-expanded on toggle", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const readyHeader = screen.getByLabelText(/Ready section/)
      expect(readyHeader).toHaveAttribute("aria-expanded", "true")

      fireEvent.click(readyHeader)
      expect(readyHeader).toHaveAttribute("aria-expanded", "false")
    })
  })

  describe("localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    // Note: The CLOSED_FILTER_STORAGE_KEY is also stored in localStorage

    it("persists collapsed state to localStorage", () => {
      render(<TaskList tasks={sampleTasks} />)

      // Click to collapse Ready group
      const readyHeader = screen.getByLabelText(/Ready section/)
      fireEvent.click(readyHeader)

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
      expect(stored.ready).toBe(true)
    })

    it("restores collapsed state from localStorage", () => {
      // Pre-set localStorage with Ready collapsed
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          blocked: false, // Override default
          ready: true,
          in_progress: false,
          closed: false,
        }),
      )

      render(<TaskList tasks={sampleTasks} />)

      // Ready should be collapsed (from localStorage)
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()

      // Blocked should be expanded (overriding default from localStorage)
      expect(screen.getByText("Blocked task")).toBeInTheDocument()
    })

    it("does not persist when persistCollapsedState is false", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const readyHeader = screen.getByLabelText(/Ready section/)
      fireEvent.click(readyHeader)

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it("does not read from localStorage when persistCollapsedState is false", () => {
      // Pre-set localStorage with Ready collapsed
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          blocked: false,
          ready: true,
          in_progress: false,
          closed: false,
        }),
      )

      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      // Ready should be expanded (ignoring localStorage, using defaults)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
    })

    it("defaultCollapsed prop overrides localStorage", () => {
      // Pre-set localStorage with Ready expanded
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          blocked: false,
          ready: false,
          in_progress: false,
          closed: false,
        }),
      )

      // But defaultCollapsed says Ready should be collapsed
      render(<TaskList tasks={sampleTasks} defaultCollapsed={{ ready: true }} />)

      // defaultCollapsed should win
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })
  })

  describe("callbacks", () => {
    it("calls onStatusChange when task status is changed", () => {
      const onStatusChange = vi.fn()
      render(<TaskList tasks={sampleTasks} onStatusChange={onStatusChange} />)

      // Click status icon on first open task (task-2 is first due to priority sorting)
      const statusButtons = screen.getAllByLabelText("Status: Open. Click to change.")
      fireEvent.click(statusButtons[0])

      // Select a new status
      fireEvent.click(screen.getByRole("option", { name: "In Progress" }))

      expect(onStatusChange).toHaveBeenCalledWith("task-2", "in_progress") // task-2 is first due to priority sorting
    })

    it("calls onTaskClick when task is clicked", () => {
      const onTaskClick = vi.fn()
      render(<TaskList tasks={sampleTasks} onTaskClick={onTaskClick} />)

      // Click on task content (task-2 has title "Open task 2" and is first due to priority sorting)
      const taskButton = screen.getByRole("button", { name: "Open task 2" })
      fireEvent.click(taskButton)

      expect(onTaskClick).toHaveBeenCalledWith("task-2")
    })
  })

  describe("accessibility", () => {
    it("has list role on container", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByRole("list", { name: "Task list" })).toBeInTheDocument()
    })

    it("has listitem role on each group", () => {
      render(<TaskList tasks={sampleTasks} />)
      const items = screen.getAllByRole("listitem")
      expect(items.length).toBeGreaterThan(0)
    })

    it("group headers have button role", () => {
      render(<TaskList tasks={sampleTasks} />)
      const readyHeader = screen.getByLabelText(/Ready section/)
      expect(readyHeader).toHaveAttribute("role", "button")
    })

    it("group headers are keyboard accessible", () => {
      render(<TaskList tasks={sampleTasks} />)
      const readyHeader = screen.getByLabelText(/Ready section/)
      expect(readyHeader).toHaveAttribute("tabIndex", "0")
    })

    it("task groups have group role", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByRole("group", { name: "Ready tasks" })).toBeInTheDocument()
    })
  })

  describe("epic grouping within status", () => {
    // Tasks are grouped by status first, then by epic within each status
    const tasksWithEpic: TaskCardTask[] = [
      { id: "epic-1", title: "Epic with tasks", status: "open", issue_type: "epic" },
      { id: "task-1", title: "Child task 1", status: "open", parent: "epic-1" },
      { id: "task-2", title: "Child task 2", status: "open", parent: "epic-1" },
      { id: "task-3", title: "Child task 3", status: "in_progress", parent: "epic-1" },
    ]

    const tasksWithMultipleEpics: TaskCardTask[] = [
      { id: "epic-1", title: "Epic A", status: "open", issue_type: "epic", priority: 1 },
      { id: "epic-2", title: "Epic B", status: "open", issue_type: "epic", priority: 2 },
      { id: "task-1", title: "Child of A", status: "open", parent: "epic-1" },
      { id: "task-2", title: "Child of B", status: "open", parent: "epic-2" },
      { id: "task-3", title: "Ungrouped task", status: "open" },
    ]

    const epicWithoutSubtasks: TaskCardTask[] = [
      { id: "epic-1", title: "Empty epic", status: "open", issue_type: "epic" },
    ]

    it("renders epic sub-header within status group", () => {
      render(<TaskList tasks={tasksWithEpic} persistCollapsedState={false} />)
      // Should have Ready status group with 2 tasks from epic
      expect(screen.getByLabelText("Ready section, 2 tasks")).toBeInTheDocument()
      // Should have In Progress status group with 1 task from epic
      expect(screen.getByLabelText("In progress section, 1 task")).toBeInTheDocument()
      // Should show epic sub-header within Ready group
      expect(screen.getByLabelText("Epic with tasks epic, 2 tasks")).toBeInTheDocument()
    })

    it("groups tasks by epic within each status", () => {
      render(<TaskList tasks={tasksWithMultipleEpics} persistCollapsedState={false} />)
      // Should have one Ready group with all 3 tasks
      expect(screen.getByLabelText("Ready section, 3 tasks")).toBeInTheDocument()
      // Should show epic sub-headers
      expect(screen.getByLabelText("Epic A epic, 1 task")).toBeInTheDocument()
      expect(screen.getByLabelText("Epic B epic, 1 task")).toBeInTheDocument()
      // Ungrouped task should be visible directly (no epic header)
      expect(screen.getByText("Ungrouped task")).toBeInTheDocument()
    })

    it("allows toggling epic sub-group within status", () => {
      render(<TaskList tasks={tasksWithEpic} persistCollapsedState={false} />)
      const epicHeader = screen.getByLabelText("Epic with tasks epic, 2 tasks")

      // Initially expanded
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 2")).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(epicHeader)
      expect(screen.queryByText("Child task 1")).not.toBeInTheDocument()
      expect(screen.queryByText("Child task 2")).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(epicHeader)
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
    })

    it("shows empty state when epic has no subtasks", () => {
      render(<TaskList tasks={epicWithoutSubtasks} persistCollapsedState={false} />)
      // No tasks to display (epic itself is not shown as a task)
      expect(screen.getByRole("status", { name: "No tasks" })).toBeInTheDocument()
    })

    it("does not show 'No tasks in this epic' message for empty epics", () => {
      render(<TaskList tasks={epicWithoutSubtasks} persistCollapsedState={false} />)
      expect(screen.queryByText("No tasks in this epic")).not.toBeInTheDocument()
    })

    it("sorts epic sub-groups by epic priority", () => {
      const tasks: TaskCardTask[] = [
        {
          id: "epic-low",
          title: "Low Priority Epic",
          status: "open",
          issue_type: "epic",
          priority: 3,
        },
        {
          id: "epic-high",
          title: "High Priority Epic",
          status: "open",
          issue_type: "epic",
          priority: 1,
        },
        { id: "task-low", title: "Low epic task", status: "open", parent: "epic-low" },
        { id: "task-high", title: "High epic task", status: "open", parent: "epic-high" },
      ]
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Get all epic headers within the Ready group
      const epicHeaders = screen.getAllByLabelText(/epic, 1 task/)
      expect(epicHeaders).toHaveLength(2)
      // High priority epic should come first
      expect(epicHeaders[0]).toHaveTextContent("High Priority Epic")
      expect(epicHeaders[1]).toHaveTextContent("Low Priority Epic")
    })
  })

  describe("closed tasks time filter", () => {
    beforeEach(() => {
      localStorage.clear()
      // Reset to default filter before each test
      useAppStore.getState().setClosedTimeFilter("past_day")
    })

    afterEach(() => {
      localStorage.clear()
      // Reset to default filter after each test
      useAppStore.getState().setClosedTimeFilter("past_day")
    })

    it("shows time filter dropdown in closed group header", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} />)

      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      expect(filterDropdown).toBeInTheDocument()
    })

    it("defaults to past_day filter", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      expect(filterDropdown).toHaveValue("past_day")
    })

    it("filters closed tasks based on time selection", () => {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 mins ago
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

      const tasks: TaskCardTask[] = [
        { id: "task-recent", title: "Recent task", status: "closed", closed_at: hourAgo },
        { id: "task-old", title: "Old task", status: "closed", closed_at: twoDaysAgo },
      ]
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // With past_day (default), only recent task should appear
      expect(screen.getByText("Recent task")).toBeInTheDocument()
      expect(screen.queryByText("Old task")).not.toBeInTheDocument()

      // Change to past_week
      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      fireEvent.change(filterDropdown, { target: { value: "past_week" } })

      // Now both tasks should appear
      expect(screen.getByText("Recent task")).toBeInTheDocument()
      expect(screen.getByText("Old task")).toBeInTheDocument()
    })

    it("shows all closed tasks when all_time is selected", () => {
      const now = new Date()
      const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago

      const tasks: TaskCardTask[] = [
        { id: "task-old", title: "Very old task", status: "closed", closed_at: oldDate },
      ]
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
          showEmptyGroups={true}
        />,
      )

      // Initially with past_day, no tasks visible (but group header with dropdown is visible)
      expect(screen.queryByText("Very old task")).not.toBeInTheDocument()

      // Change to all_time
      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      fireEvent.change(filterDropdown, { target: { value: "all_time" } })

      // Now task should appear
      expect(screen.getByText("Very old task")).toBeInTheDocument()
    })

    it("persists time filter selection to localStorage via store", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} />)

      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      fireEvent.change(filterDropdown, { target: { value: "past_week" } })

      // Store persists to localStorage automatically
      expect(localStorage.getItem(CLOSED_FILTER_STORAGE_KEY)).toBe("past_week")
      expect(useAppStore.getState().closedTimeFilter).toBe("past_week")
    })

    it("uses store value for time filter", () => {
      // Set the store value directly
      useAppStore.getState().setClosedTimeFilter("all_time")

      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} />)

      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      expect(filterDropdown).toHaveValue("all_time")
    })

    it("time filter is global state (always persisted)", () => {
      // Note: persistCollapsedState no longer affects time filter since it's global state
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      fireEvent.change(filterDropdown, { target: { value: "past_week" } })

      // Time filter is stored via the global store, which always persists
      expect(localStorage.getItem(CLOSED_FILTER_STORAGE_KEY)).toBe("past_week")
    })

    it("updates task count when filter changes", () => {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "closed", closed_at: hourAgo },
        { id: "task-2", title: "Task 2", status: "closed", closed_at: twoDaysAgo },
      ]
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Initially should show 1 task with past_day filter
      expect(screen.getByLabelText("Closed section, 1 task")).toBeInTheDocument()

      // Change to past_week
      const filterDropdown = screen.getByRole("combobox", { name: "Filter closed tasks by time" })
      fireEvent.change(filterDropdown, { target: { value: "past_week" } })

      // Now should show 2 tasks
      expect(screen.getByLabelText("Closed section, 2 tasks")).toBeInTheDocument()
    })

    it("does not show time filter dropdown for non-closed groups", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Open task", status: "open" },
        { id: "task-2", title: "Closed task", status: "closed", closed_at: getRecentDate() },
      ]
      render(<TaskList tasks={tasks} />)

      // Only one combobox should exist (for closed group)
      const filterDropdowns = screen.getAllByRole("combobox")
      expect(filterDropdowns).toHaveLength(1)
    })
  })

  describe("search filtering", () => {
    beforeEach(() => {
      useAppStore.getState().clearTaskSearchQuery()
    })

    afterEach(() => {
      useAppStore.getState().clearTaskSearchQuery()
    })

    it("filters tasks by title", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Fix authentication bug", status: "open" },
        { id: "task-2", title: "Add new feature", status: "open" },
        { id: "task-3", title: "Update documentation", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("auth")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.queryByText("Add new feature")).not.toBeInTheDocument()
      expect(screen.queryByText("Update documentation")).not.toBeInTheDocument()
    })

    it("filters tasks by id", () => {
      const tasks: TaskCardTask[] = [
        { id: "rui-abc", title: "First task", status: "open" },
        { id: "rui-xyz", title: "Second task", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("xyz")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Second task")).toBeInTheDocument()
      expect(screen.queryByText("First task")).not.toBeInTheDocument()
    })

    it("filters tasks by description", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open", description: "This is about React hooks" },
        {
          id: "task-2",
          title: "Task 2",
          status: "open",
          description: "This is about Vue components",
        },
      ]
      useAppStore.getState().setTaskSearchQuery("React")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Task 1")).toBeInTheDocument()
      expect(screen.queryByText("Task 2")).not.toBeInTheDocument()
    })

    it("is case insensitive", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "FIX AUTHENTICATION", status: "open" },
        { id: "task-2", title: "Add Feature", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("fix")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("FIX AUTHENTICATION")).toBeInTheDocument()
      expect(screen.queryByText("Add Feature")).not.toBeInTheDocument()
    })

    it("shows all tasks when search query is empty", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open" },
        { id: "task-2", title: "Task 2", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Task 1")).toBeInTheDocument()
      expect(screen.getByText("Task 2")).toBeInTheDocument()
    })

    it("shows all tasks when search query is only whitespace", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open" },
        { id: "task-2", title: "Task 2", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("   ")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Task 1")).toBeInTheDocument()
      expect(screen.getByText("Task 2")).toBeInTheDocument()
    })

    it("shows 'No matching tasks' when no tasks match", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open" },
        { id: "task-2", title: "Task 2", status: "open" },
      ]
      useAppStore.getState().setTaskSearchQuery("nonexistent")
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("No matching tasks")).toBeInTheDocument()
    })

    it("updates filtered results when query changes", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Fix bug", status: "open" },
        { id: "task-2", title: "Add feature", status: "open" },
      ]

      // Start with one search
      useAppStore.getState().setTaskSearchQuery("bug")
      const { rerender } = render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.getByText("Fix bug")).toBeInTheDocument()
      expect(screen.queryByText("Add feature")).not.toBeInTheDocument()

      // Change query
      useAppStore.getState().setTaskSearchQuery("feature")
      rerender(<TaskList tasks={tasks} persistCollapsedState={false} />)

      expect(screen.queryByText("Fix bug")).not.toBeInTheDocument()
      expect(screen.getByText("Add feature")).toBeInTheDocument()
    })

    it("filters across all status groups", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Open auth task", status: "open" },
        { id: "task-2", title: "In progress auth task", status: "in_progress" },
        { id: "task-3", title: "Blocked other task", status: "blocked" },
        { id: "task-4", title: "Closed auth task", status: "closed", closed_at: getRecentDate() },
      ]
      useAppStore.getState().setTaskSearchQuery("auth")
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ blocked: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      expect(screen.getByText("Open auth task")).toBeInTheDocument()
      expect(screen.getByText("In progress auth task")).toBeInTheDocument()
      expect(screen.getByText("Closed auth task")).toBeInTheDocument()
      expect(screen.queryByText("Blocked other task")).not.toBeInTheDocument()
    })
  })
})
