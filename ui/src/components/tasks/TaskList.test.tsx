import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskList } from "./TaskList"
import type { TaskCardTask } from "@/types"
import { useAppStore } from "@/store"
import type { TaskGroup } from "@/types"
import { TASK_LIST_STATUS_STORAGE_KEY, TASK_LIST_CLOSED_FILTER_STORAGE_KEY } from "@/constants"

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

    it("renders loading skeleton when isLoading is true", () => {
      render(<TaskList tasks={[]} isLoading={true} />)
      expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument()
      expect(screen.queryByRole("list", { name: "Task list" })).not.toBeInTheDocument()
    })

    it("renders task list when isLoading is false", () => {
      render(<TaskList tasks={sampleTasks} isLoading={false} />)
      expect(screen.getByRole("list", { name: "Task list" })).toBeInTheDocument()
      expect(screen.queryByRole("status", { name: "Loading tasks" })).not.toBeInTheDocument()
    })

    it("renders all group headers", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByLabelText(/Open section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Closed section/)).toBeInTheDocument()
    })

    it("displays correct task counts in headers", () => {
      render(<TaskList tasks={sampleTasks} />)
      // Open group includes: blocked (1), open (2), in_progress (1) = 4 tasks
      expect(screen.getByLabelText("Open section, 4 tasks")).toBeInTheDocument()
      // Closed group includes: deferred (1), closed (1) = 2 tasks
      expect(screen.getByLabelText("Closed section, 2 tasks")).toBeInTheDocument()
    })

    it("renders tasks within groups", () => {
      // Override defaults to expand all groups for this test
      render(<TaskList tasks={sampleTasks} defaultCollapsed={{ open: false, closed: false }} />)
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

      expect(screen.getByLabelText(/Open section/)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })

    it("shows empty groups when showEmptyGroups is true", () => {
      const tasksOnlyOpen: TaskCardTask[] = [{ id: "task-1", title: "Open task", status: "open" }]
      render(<TaskList tasks={tasksOnlyOpen} showEmptyGroups />)

      expect(screen.getByLabelText(/Open section/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Closed section/)).toBeInTheDocument()
    })

    it("shows empty message within empty groups", () => {
      const tasksOnlyOpen: TaskCardTask[] = [{ id: "task-1", title: "Open task", status: "open" }]
      render(<TaskList tasks={tasksOnlyOpen} showEmptyGroups />)

      // Closed group should show "No tasks in this group"
      expect(screen.getAllByText("No tasks in this group").length).toBeGreaterThan(0)
    })
  })

  describe("grouping", () => {
    it("groups open tasks under Open", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Open task", status: "open" },
        { id: "task-2", title: "Another open", status: "open" },
      ]
      render(<TaskList tasks={tasks} />)

      const openHeader = screen.getByLabelText("Open section, 2 tasks")
      expect(openHeader).toBeInTheDocument()
    })

    it("groups in_progress tasks under Open", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Working on it", status: "in_progress" },
      ]
      render(<TaskList tasks={tasks} />)

      const header = screen.getByLabelText("Open section, 1 task")
      expect(header).toBeInTheDocument()
    })

    it("groups blocked tasks under Open", () => {
      const tasks: TaskCardTask[] = [{ id: "task-1", title: "Stuck task", status: "blocked" }]
      render(<TaskList tasks={tasks} />)

      const header = screen.getByLabelText("Open section, 1 task")
      expect(header).toBeInTheDocument()
    })

    it("groups open, in_progress, and blocked tasks together under Open", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Open task", status: "open" },
        { id: "task-2", title: "In progress task", status: "in_progress" },
        { id: "task-3", title: "Blocked task", status: "blocked" },
      ]
      render(<TaskList tasks={tasks} />)

      // All three should be in the Open section
      expect(screen.getByLabelText("Open section, 3 tasks")).toBeInTheDocument()
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

    it("shows bugs before other types within the same priority", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "task-feature",
          title: "Feature task",
          status: "open",
          priority: 2,
          issue_type: "task",
          created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago (older)
        },
        {
          id: "task-bug",
          title: "Bug task",
          status: "open",
          priority: 2,
          issue_type: "bug",
          created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago (newer)
        },
        {
          id: "task-epic",
          title: "Epic task",
          status: "open",
          priority: 2,
          issue_type: "epic",
          created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
      ]
      render(<TaskList tasks={tasks} />)

      // Bug should come first even though it's newer
      const taskTitles = screen.getAllByText(/task$/).map(el => el.textContent)
      expect(taskTitles).toEqual(["Bug task", "Feature task", "Epic task"])
    })

    it("sorts by created_at when same priority and both are bugs", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        {
          id: "bug-newer",
          title: "Newer bug",
          status: "open",
          priority: 2,
          issue_type: "bug",
          created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
        {
          id: "bug-older",
          title: "Older bug",
          status: "open",
          priority: 2,
          issue_type: "bug",
          created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
      ]
      render(<TaskList tasks={tasks} />)

      // Older bug should come first (oldest first within same priority and type)
      const taskTitles = screen.getAllByText(/bug$/).map(el => el.textContent)
      expect(taskTitles).toEqual(["Older bug", "Newer bug"])
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
      const taskTitles = screen.getAllByText(/^(No|Has) create date$/).map(el => el.textContent)
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
      const taskTitles = screen.getAllByText(/^(Has|No) close date$/).map(el => el.textContent)
      expect(taskTitles).toEqual(["Has close date", "No close date"])

      // Reset to default
      useAppStore.getState().setClosedTimeFilter("past_day")
    })

    it("sorts closed parent groups by most recently closed first", () => {
      const now = new Date()
      const tasks: TaskCardTask[] = [
        // Parent closed earlier (will appear second)
        {
          id: "parent-old",
          title: "Parent closed earlier",
          status: "closed",
          issue_type: "epic",
          closed_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
        {
          id: "child-old",
          title: "Child of old parent",
          status: "closed",
          parent: "parent-old",
          closed_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        },
        // Parent closed more recently (will appear first)
        {
          id: "parent-new",
          title: "Parent closed later",
          status: "closed",
          issue_type: "epic",
          closed_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
        {
          id: "child-new",
          title: "Child of new parent",
          status: "closed",
          parent: "parent-new",
          closed_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        },
      ]
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Get parent titles in order - they should be sorted by closed_at (most recent first)
      const parentTitles = screen.getAllByText(/Parent closed/).map(el => el.textContent)
      expect(parentTitles).toEqual(["Parent closed later", "Parent closed earlier"])
    })
  })

  describe("collapse/expand", () => {
    it("expands Open group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      // Tasks should be visible
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
      expect(screen.getByText("In progress task")).toBeInTheDocument()
      expect(screen.getByText("Blocked task")).toBeInTheDocument()
    })

    it("collapses Closed group by default", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)
      // Closed group (deferred/closed) tasks should not be visible
      expect(screen.queryByText("Deferred task")).not.toBeInTheDocument()
      expect(screen.queryByText("Closed task")).not.toBeInTheDocument()
    })

    it("toggles group on header click", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const openHeader = screen.getByLabelText(/Open section/)

      // Initially expanded, tasks visible
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(openHeader)
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()

      // Click to expand again
      fireEvent.click(openHeader)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
    })

    it("toggles group on Enter key", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const openHeader = screen.getByLabelText(/Open section/)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      fireEvent.keyDown(openHeader, { key: "Enter" })
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })

    it("toggles group on Space key", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const openHeader = screen.getByLabelText(/Open section/)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()

      fireEvent.keyDown(openHeader, { key: " " })
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })

    it("respects defaultCollapsed prop", () => {
      const defaultCollapsed: Partial<Record<TaskGroup, boolean>> = {
        open: true,
        closed: false,
      }
      // Use sample tasks with recent closed_at dates
      const tasksWithRecentClosed = sampleTasks.map(t =>
        t.status === "deferred" || t.status === "closed" ? { ...t, closed_at: getRecentDate() } : t,
      )
      render(<TaskList tasks={tasksWithRecentClosed} defaultCollapsed={defaultCollapsed} />)

      // Open should be collapsed
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
      expect(screen.queryByText("In progress task")).not.toBeInTheDocument()
      expect(screen.queryByText("Blocked task")).not.toBeInTheDocument()

      // Closed should be expanded (overriding default behavior)
      expect(screen.getByText("Deferred task")).toBeInTheDocument()
    })

    it("updates aria-expanded on toggle", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const openHeader = screen.getByLabelText(/Open section/)
      expect(openHeader).toHaveAttribute("aria-expanded", "true")

      fireEvent.click(openHeader)
      expect(openHeader).toHaveAttribute("aria-expanded", "false")
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

      // Click to collapse Open group
      const openHeader = screen.getByLabelText(/Open section/)
      fireEvent.click(openHeader)

      const stored = JSON.parse(localStorage.getItem(TASK_LIST_STATUS_STORAGE_KEY) ?? "{}")
      expect(stored.open).toBe(true)
    })

    it("restores collapsed state from localStorage", () => {
      // Pre-set localStorage with Open collapsed
      localStorage.setItem(
        TASK_LIST_STATUS_STORAGE_KEY,
        JSON.stringify({
          open: true,
          closed: false,
        }),
      )

      render(<TaskList tasks={sampleTasks} />)

      // Open should be collapsed (from localStorage)
      expect(screen.queryByText("Open task 1")).not.toBeInTheDocument()
    })

    it("does not persist when persistCollapsedState is false", () => {
      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      const openHeader = screen.getByLabelText(/Open section/)
      fireEvent.click(openHeader)

      expect(localStorage.getItem(TASK_LIST_STATUS_STORAGE_KEY)).toBeNull()
    })

    it("does not read from localStorage when persistCollapsedState is false", () => {
      // Pre-set localStorage with Open collapsed
      localStorage.setItem(
        TASK_LIST_STATUS_STORAGE_KEY,
        JSON.stringify({
          open: true,
          closed: false,
        }),
      )

      render(<TaskList tasks={sampleTasks} persistCollapsedState={false} />)

      // Open should be expanded (ignoring localStorage, using defaults)
      expect(screen.getByText("Open task 1")).toBeInTheDocument()
    })

    it("defaultCollapsed prop overrides localStorage", () => {
      // Pre-set localStorage with Open expanded
      localStorage.setItem(
        TASK_LIST_STATUS_STORAGE_KEY,
        JSON.stringify({
          open: false,
          closed: false,
        }),
      )

      // But defaultCollapsed says Open should be collapsed
      render(<TaskList tasks={sampleTasks} defaultCollapsed={{ open: true }} />)

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
      const openHeader = screen.getByLabelText(/Open section/)
      expect(openHeader).toHaveAttribute("role", "button")
    })

    it("group headers are keyboard accessible", () => {
      render(<TaskList tasks={sampleTasks} />)
      const openHeader = screen.getByLabelText(/Open section/)
      expect(openHeader).toHaveAttribute("tabIndex", "0")
    })

    it("task groups have group role", () => {
      render(<TaskList tasks={sampleTasks} />)
      expect(screen.getByRole("group", { name: "Open tasks" })).toBeInTheDocument()
    })
  })

  describe("epic grouping within status", () => {
    // Subtasks are grouped with their parent (in parent's status group) until parent is closed
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

    it("renders all subtasks with parent regardless of their status", () => {
      render(<TaskList tasks={tasksWithEpic} persistCollapsedState={false} />)
      // Should have Open status group with epic + ALL 3 subtasks = 4 tasks
      // (in_progress child stays with open parent)
      expect(screen.getByLabelText("Open section, 4 tasks")).toBeInTheDocument()
      // Should show epic task card within Open group
      expect(screen.getByText("Epic with tasks")).toBeInTheDocument()
      // All children should be visible under the parent
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 2")).toBeInTheDocument()
      expect(screen.getByText("Child task 3")).toBeInTheDocument()
    })

    it("groups tasks by epic within each status", () => {
      render(<TaskList tasks={tasksWithMultipleEpics} persistCollapsedState={false} />)
      // Should have one Open group with 2 epics + 1 child each + 1 ungrouped = 5 tasks
      expect(screen.getByLabelText("Open section, 5 tasks")).toBeInTheDocument()
      // Should show epic task cards
      expect(screen.getByText("Epic A")).toBeInTheDocument()
      expect(screen.getByText("Epic B")).toBeInTheDocument()
      // Should show children
      expect(screen.getByText("Child of A")).toBeInTheDocument()
      expect(screen.getByText("Child of B")).toBeInTheDocument()
      // Ungrouped task should be visible directly (no epic header)
      expect(screen.getByText("Ungrouped task")).toBeInTheDocument()
    })

    it("allows toggling epic sub-group within status", () => {
      render(<TaskList tasks={tasksWithEpic} persistCollapsedState={false} />)
      // Find the collapse button by aria-label
      const collapseButton = screen.getByLabelText("Collapse subtasks")

      // Initially expanded - all children should be visible (regardless of their status)
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 2")).toBeInTheDocument()
      expect(screen.getByText("Child task 3")).toBeInTheDocument() // in_progress child

      // Click chevron to collapse
      fireEvent.click(collapseButton)
      expect(screen.queryByText("Child task 1")).not.toBeInTheDocument()
      expect(screen.queryByText("Child task 2")).not.toBeInTheDocument()
      expect(screen.queryByText("Child task 3")).not.toBeInTheDocument()

      // Click chevron to expand
      const expandButton = screen.getByLabelText("Expand subtasks")
      fireEvent.click(expandButton)
      expect(screen.getByText("Child task 1")).toBeInTheDocument()
      expect(screen.getByText("Child task 3")).toBeInTheDocument() // in_progress child is back
    })

    it("shows empty state when epic has no subtasks", () => {
      render(<TaskList tasks={epicWithoutSubtasks} persistCollapsedState={false} />)
      // Epic itself should be shown as a task card (1 task)
      expect(screen.getByLabelText("Open section, 1 task")).toBeInTheDocument()
      expect(screen.getByText("Empty epic")).toBeInTheDocument()
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

      // Get all tasks within the list
      const openGroup = screen.getByLabelText("Open group")
      const taskTitles = Array.from(openGroup.querySelectorAll("[role='button']"))
        .map(el => el.textContent)
        .filter(text => text?.includes("Epic"))

      expect(taskTitles).toHaveLength(2)
      // High priority epic should come first
      expect(taskTitles[0]).toContain("High Priority Epic")
      expect(taskTitles[1]).toContain("Low Priority Epic")
    })

    it("interleaves epics and standalone tasks by priority", () => {
      const tasks: TaskCardTask[] = [
        {
          id: "epic-p3",
          title: "P3 Epic",
          status: "open",
          issue_type: "epic",
          priority: 3,
        },
        {
          id: "task-p2",
          title: "P2 Standalone Task",
          status: "open",
          priority: 2,
        },
        {
          id: "task-p1",
          title: "P1 Standalone Task",
          status: "open",
          priority: 1,
        },
        { id: "epic-child", title: "P3 Epic Child", status: "open", parent: "epic-p3" },
      ]
      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Get all top-level items in order (epics and standalone tasks)
      const openGroup = screen.getByLabelText("Open group")
      const taskButtons = Array.from(openGroup.querySelectorAll("[role='button']"))
        .map(el => el.textContent)
        .filter(text => text && (text.includes("P1") || text.includes("P2") || text.includes("P3")))

      // Should be sorted by priority: P1, P2, P3
      expect(taskButtons).toHaveLength(4) // P1 task, P2 task, P3 epic, P3 epic child
      expect(taskButtons[0]).toContain("P1 Standalone Task")
      expect(taskButtons[1]).toContain("P2 Standalone Task")
      expect(taskButtons[2]).toContain("P3 Epic")
      expect(taskButtons[3]).toContain("P3 Epic Child")
    })

    it("calls onTaskClick when epic card content is clicked", () => {
      const onTaskClick = vi.fn()
      render(
        <TaskList tasks={tasksWithEpic} onTaskClick={onTaskClick} persistCollapsedState={false} />,
      )

      // Click on the epic card content (not the chevron)
      const epicButton = screen.getByRole("button", { name: "Epic with tasks" })
      fireEvent.click(epicButton)

      // Should call onTaskClick with epic ID
      expect(onTaskClick).toHaveBeenCalledWith("epic-1")
      expect(onTaskClick).toHaveBeenCalledTimes(1)
    })

    it("clicking chevron does not call onTaskClick", () => {
      const onTaskClick = vi.fn()
      render(
        <TaskList tasks={tasksWithEpic} onTaskClick={onTaskClick} persistCollapsedState={false} />,
      )

      // Click on the chevron button
      const chevronButton = screen.getByLabelText("Collapse subtasks")
      fireEvent.click(chevronButton)

      // Should NOT call onTaskClick
      expect(onTaskClick).not.toHaveBeenCalled()

      // But should collapse the subtasks
      expect(screen.queryByText("Child task 1")).not.toBeInTheDocument()
    })

    it("allows clicking epic to open details and chevron to toggle subtasks independently", () => {
      const onTaskClick = vi.fn()
      render(
        <TaskList tasks={tasksWithEpic} onTaskClick={onTaskClick} persistCollapsedState={false} />,
      )

      // First, click the epic content to open details
      const epicButton = screen.getByRole("button", { name: "Epic with tasks" })
      fireEvent.click(epicButton)
      expect(onTaskClick).toHaveBeenCalledWith("epic-1")
      expect(onTaskClick).toHaveBeenCalledTimes(1)

      // Subtasks should still be visible (clicking epic doesn't collapse them)
      expect(screen.getByText("Child task 1")).toBeInTheDocument()

      // Reset the mock
      onTaskClick.mockClear()

      // Now click the chevron to collapse subtasks
      const chevronButton = screen.getByLabelText("Collapse subtasks")
      fireEvent.click(chevronButton)

      // Should NOT call onTaskClick again
      expect(onTaskClick).not.toHaveBeenCalled()

      // But should collapse the subtasks
      expect(screen.queryByText("Child task 1")).not.toBeInTheDocument()
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
      expect(localStorage.getItem(TASK_LIST_CLOSED_FILTER_STORAGE_KEY)).toBe("past_week")
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
      expect(localStorage.getItem(TASK_LIST_CLOSED_FILTER_STORAGE_KEY)).toBe("past_week")
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
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      expect(screen.getByText("Open auth task")).toBeInTheDocument()
      expect(screen.getByText("In progress auth task")).toBeInTheDocument()
      expect(screen.getByText("Closed auth task")).toBeInTheDocument()
      expect(screen.queryByText("Blocked other task")).not.toBeInTheDocument()
    })

    it("includes closed tasks outside time filter when searching", () => {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 mins ago
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

      const tasks: TaskCardTask[] = [
        { id: "task-recent", title: "Recent auth task", status: "closed", closed_at: hourAgo },
        { id: "task-old", title: "Old auth task", status: "closed", closed_at: twoDaysAgo },
        { id: "task-other", title: "Old other task", status: "closed", closed_at: twoDaysAgo },
      ]

      // Default filter is past_day, so old tasks would normally be hidden
      useAppStore.getState().setClosedTimeFilter("past_day")

      // Without search, old task should not appear
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )
      expect(screen.getByText("Recent auth task")).toBeInTheDocument()
      expect(screen.queryByText("Old auth task")).not.toBeInTheDocument()

      // Now search for "auth" - should include both recent and old auth tasks
      useAppStore.getState().setTaskSearchQuery("auth")

      // Re-render to apply search
      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Both auth tasks should now be visible (bypassing time filter)
      expect(screen.getAllByText("Recent auth task").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Old auth task").length).toBeGreaterThanOrEqual(1)
      // But non-matching task should not appear
      expect(screen.queryByText("Old other task")).not.toBeInTheDocument()
    })
  })

  describe("new task animation", () => {
    it("marks newly added tasks with isNew prop", () => {
      const initialTasks: TaskCardTask[] = [
        { id: "task-1", title: "Existing task", status: "open" },
      ]

      const { rerender } = render(<TaskList tasks={initialTasks} />)

      // Add a new task
      const updatedTasks: TaskCardTask[] = [
        { id: "task-1", title: "Existing task", status: "open" },
        { id: "task-2", title: "New task", status: "open" },
      ]

      rerender(<TaskList tasks={updatedTasks} />)

      // The new task should have the animation class
      const newTaskElement = screen.getByText("New task").closest(".animate-bounceIn")
      expect(newTaskElement).toBeInTheDocument()
    })

    it("does not mark existing tasks as new", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open" },
        { id: "task-2", title: "Task 2", status: "open" },
      ]

      const { container } = render(<TaskList tasks={tasks} />)

      // No tasks should have animation class on initial render
      const animatedElements = container.querySelectorAll(".animate-bounceIn")
      expect(animatedElements).toHaveLength(0)
    })

    it("handles multiple new tasks at once", () => {
      const initialTasks: TaskCardTask[] = [
        { id: "task-1", title: "Existing task", status: "open" },
      ]

      const { rerender } = render(<TaskList tasks={initialTasks} />)

      // Add multiple new tasks
      const updatedTasks: TaskCardTask[] = [
        { id: "task-1", title: "Existing task", status: "open" },
        { id: "task-2", title: "New task 1", status: "open" },
        { id: "task-3", title: "New task 2", status: "open" },
      ]

      rerender(<TaskList tasks={updatedTasks} />)

      // Both new tasks should have animation class
      const newTask1Element = screen.getByText("New task 1").closest(".animate-bounceIn")
      const newTask2Element = screen.getByText("New task 2").closest(".animate-bounceIn")
      expect(newTask1Element).toBeInTheDocument()
      expect(newTask2Element).toBeInTheDocument()
    })
  })

  describe("non-epic parent tasks", () => {
    it("groups regular tasks with children under parent in same status", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Parent task", status: "open", issue_type: "task" },
        { id: "parent-1.1", title: "Subtask 1", status: "open", parent: "parent-1" },
        { id: "parent-1.2", title: "Subtask 2", status: "open", parent: "parent-1" },
      ]

      render(<TaskList tasks={tasks} />)

      // All should be in Open group (parent + 2 subtasks = 3 tasks)
      expect(screen.getByText("Open")).toBeInTheDocument()
      expect(screen.getByText("Parent task")).toBeInTheDocument()
      expect(screen.getByText("Subtask 1")).toBeInTheDocument()
      expect(screen.getByText("Subtask 2")).toBeInTheDocument()
    })

    it("allows toggling non-epic parent tasks", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Parent task", status: "open", issue_type: "task" },
        { id: "parent-1.1", title: "Child 1", status: "open", parent: "parent-1" },
        { id: "parent-1.2", title: "Child 2", status: "open", parent: "parent-1" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Parent should be visible
      expect(screen.getByText("Parent task")).toBeInTheDocument()

      // Children should be visible initially
      expect(screen.getByText("Child 1")).toBeInTheDocument()
      expect(screen.getByText("Child 2")).toBeInTheDocument()

      // Find the collapse button by aria-label
      const collapseButton = screen.getByLabelText("Collapse subtasks")

      // Click chevron to collapse
      fireEvent.click(collapseButton)

      // Children should be hidden
      expect(screen.queryByText("Child 1")).not.toBeInTheDocument()
      expect(screen.queryByText("Child 2")).not.toBeInTheDocument()

      // Click again to expand
      const expandButton = screen.getByLabelText("Expand subtasks")
      fireEvent.click(expandButton)

      // Children should be visible again
      expect(screen.getByText("Child 1")).toBeInTheDocument()
      expect(screen.getByText("Child 2")).toBeInTheDocument()
    })

    it("shows subtask count badge for non-epic parent tasks", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Parent with 3 children", status: "open", issue_type: "task" },
        { id: "parent-1.1", title: "Child 1", status: "open", parent: "parent-1" },
        { id: "parent-1.2", title: "Child 2", status: "open", parent: "parent-1" },
        { id: "parent-1.3", title: "Child 3", status: "open", parent: "parent-1" },
      ]

      render(<TaskList tasks={tasks} />)

      // Find the parent task card
      expect(screen.getByText("Parent with 3 children")).toBeInTheDocument()

      // The subtask count should be visible via aria-label
      const subtaskBadge = screen.getByLabelText("3 subtasks")
      expect(subtaskBadge).toBeInTheDocument()
      expect(subtaskBadge.textContent).toBe("3")
    })
  })

  describe("closed subtasks with open parent", () => {
    it("keeps closed subtasks with open parent in parent's status group", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Open parent", status: "open", issue_type: "task" },
        { id: "child-1", title: "Open child", status: "open", parent: "parent-1" },
        {
          id: "child-2",
          title: "Closed child",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Open section should have parent + both children (3 tasks)
      expect(screen.getByLabelText("Open section, 3 tasks")).toBeInTheDocument()

      // Both children should be visible in Open section under the parent
      expect(screen.getByText("Open parent")).toBeInTheDocument()
      expect(screen.getByText("Open child")).toBeInTheDocument()
      expect(screen.getByText("Closed child")).toBeInTheDocument()

      // Closed section should NOT have the closed child (parent is still open)
      // Since there are no tasks in closed section, the header shouldn't appear
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })

    it("moves closed subtasks to closed section when parent is also closed", () => {
      const tasks: TaskCardTask[] = [
        {
          id: "parent-1",
          title: "Closed parent",
          status: "closed",
          issue_type: "task",
          closed_at: getRecentDate(),
        },
        {
          id: "child-1",
          title: "Closed child 1",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
        {
          id: "child-2",
          title: "Closed child 2",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Closed section should have parent + both children (3 tasks)
      expect(screen.getByLabelText("Closed section, 3 tasks")).toBeInTheDocument()

      // All should be visible in Closed section
      expect(screen.getByText("Closed parent")).toBeInTheDocument()
      expect(screen.getByText("Closed child 1")).toBeInTheDocument()
      expect(screen.getByText("Closed child 2")).toBeInTheDocument()
    })

    it("keeps deferred subtasks with open parent in parent's status group", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "In progress parent", status: "in_progress", issue_type: "task" },
        { id: "child-1", title: "Open child", status: "open", parent: "parent-1" },
        {
          id: "child-2",
          title: "Deferred child",
          status: "deferred",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Open section should have parent + both children (3 tasks)
      expect(screen.getByLabelText("Open section, 3 tasks")).toBeInTheDocument()

      // All should be visible in Open section
      expect(screen.getByText("In progress parent")).toBeInTheDocument()
      expect(screen.getByText("Open child")).toBeInTheDocument()
      expect(screen.getByText("Deferred child")).toBeInTheDocument()

      // Closed section should NOT appear
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })

    it("handles mixed subtask statuses with open parent", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Open parent", status: "open", issue_type: "task" },
        { id: "child-1", title: "Open child", status: "open", parent: "parent-1" },
        { id: "child-2", title: "In progress child", status: "in_progress", parent: "parent-1" },
        { id: "child-3", title: "Blocked child", status: "blocked", parent: "parent-1" },
        {
          id: "child-4",
          title: "Closed child",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Open section should have parent + all 4 children (5 tasks)
      expect(screen.getByLabelText("Open section, 5 tasks")).toBeInTheDocument()

      // All children should be visible under the parent
      expect(screen.getByText("Open parent")).toBeInTheDocument()
      expect(screen.getByText("Open child")).toBeInTheDocument()
      expect(screen.getByText("In progress child")).toBeInTheDocument()
      expect(screen.getByText("Blocked child")).toBeInTheDocument()
      expect(screen.getByText("Closed child")).toBeInTheDocument()

      // Closed section should NOT appear
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })

    it("correctly counts subtasks including closed ones when parent is open", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Parent task", status: "open", issue_type: "task" },
        { id: "child-1", title: "Child 1", status: "open", parent: "parent-1" },
        {
          id: "child-2",
          title: "Child 2",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
        {
          id: "child-3",
          title: "Child 3",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // The subtask count badge should show 3 (all children regardless of status)
      const subtaskBadge = screen.getByLabelText("3 subtasks")
      expect(subtaskBadge).toBeInTheDocument()
      expect(subtaskBadge.textContent).toBe("3")
    })

    it("keeps closed subtasks grouped with siblings in blocked parent group", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent-1", title: "Blocked parent", status: "blocked", issue_type: "task" },
        { id: "child-1", title: "Open child", status: "open", parent: "parent-1" },
        {
          id: "child-2",
          title: "Closed child",
          status: "closed",
          parent: "parent-1",
          closed_at: getRecentDate(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      // Open section should have parent + both children (3 tasks)
      expect(screen.getByLabelText("Open section, 3 tasks")).toBeInTheDocument()

      // Both children should be visible under the blocked parent
      expect(screen.getByText("Blocked parent")).toBeInTheDocument()
      expect(screen.getByText("Open child")).toBeInTheDocument()
      expect(screen.getByText("Closed child")).toBeInTheDocument()

      // Closed section should NOT have the closed child
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })
  })

  describe("deeply nested hierarchies (grandchildren)", () => {
    it("renders grandchild tasks nested under their parent", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "open", issue_type: "epic" },
        { id: "parent", title: "Parent", status: "open", parent: "grandparent" },
        { id: "child", title: "Child", status: "open", parent: "parent" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // All three should be visible
      expect(screen.getByText("Grandparent")).toBeInTheDocument()
      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.getByText("Child")).toBeInTheDocument()

      // Should have correct count in Open section (grandparent + parent + child = 3)
      expect(screen.getByLabelText("Open section, 3 tasks")).toBeInTheDocument()
    })

    it("renders deeply nested hierarchy (great-grandchildren)", () => {
      const tasks: TaskCardTask[] = [
        { id: "level-0", title: "Level 0", status: "open" },
        { id: "level-1", title: "Level 1", status: "open", parent: "level-0" },
        { id: "level-2", title: "Level 2", status: "open", parent: "level-1" },
        { id: "level-3", title: "Level 3", status: "open", parent: "level-2" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // All levels should be visible
      expect(screen.getByText("Level 0")).toBeInTheDocument()
      expect(screen.getByText("Level 1")).toBeInTheDocument()
      expect(screen.getByText("Level 2")).toBeInTheDocument()
      expect(screen.getByText("Level 3")).toBeInTheDocument()

      // Should count all 4 tasks
      expect(screen.getByLabelText("Open section, 4 tasks")).toBeInTheDocument()
    })

    it("collapses parent and hides all descendants", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "open" },
        { id: "parent", title: "Parent", status: "open", parent: "grandparent" },
        { id: "child", title: "Child", status: "open", parent: "parent" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // All should be visible initially
      expect(screen.getByText("Grandparent")).toBeInTheDocument()
      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.getByText("Child")).toBeInTheDocument()

      // Collapse the grandparent (first collapse button)
      const collapseButtons = screen.getAllByLabelText("Collapse subtasks")
      fireEvent.click(collapseButtons[0])

      // Grandparent should still be visible, but parent and child hidden
      expect(screen.getByText("Grandparent")).toBeInTheDocument()
      expect(screen.queryByText("Parent")).not.toBeInTheDocument()
      expect(screen.queryByText("Child")).not.toBeInTheDocument()
    })

    it("collapsing middle parent hides only its descendants", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "open" },
        { id: "parent", title: "Parent", status: "open", parent: "grandparent" },
        { id: "child", title: "Child", status: "open", parent: "parent" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Find the parent's collapse button (second one)
      const collapseButtons = screen.getAllByLabelText("Collapse subtasks")
      expect(collapseButtons).toHaveLength(2) // Grandparent and Parent have children

      // Collapse the parent (second button)
      fireEvent.click(collapseButtons[1])

      // Grandparent and Parent should be visible, but Child hidden
      expect(screen.getByText("Grandparent")).toBeInTheDocument()
      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.queryByText("Child")).not.toBeInTheDocument()
    })

    it("counts all descendants for subtask badge", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "open" },
        { id: "parent-1", title: "Parent 1", status: "open", parent: "grandparent" },
        { id: "parent-2", title: "Parent 2", status: "open", parent: "grandparent" },
        { id: "child-1", title: "Child 1", status: "open", parent: "parent-1" },
        { id: "child-2", title: "Child 2", status: "open", parent: "parent-1" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Grandparent should show 4 descendants (2 parents + 2 children)
      const grandparentBadge = screen.getByLabelText("4 subtasks")
      expect(grandparentBadge).toBeInTheDocument()
      expect(grandparentBadge.textContent).toBe("4")

      // Parent 1 should show 2 descendants
      const parent1Badge = screen.getByLabelText("2 subtasks")
      expect(parent1Badge).toBeInTheDocument()
      expect(parent1Badge.textContent).toBe("2")
    })

    it("applies increasing indentation for each nesting level", () => {
      const tasks: TaskCardTask[] = [
        { id: "level-0", title: "Level 0", status: "open" },
        { id: "level-1", title: "Level 1", status: "open", parent: "level-0" },
        { id: "level-2", title: "Level 2", status: "open", parent: "level-1" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Level 0 should have no padding
      const level0 = screen.getByText("Level 0").closest("[data-task-id]")
      expect(level0).not.toHaveClass("pl-6")

      // Level 1 should have pl-6 class
      const level1 = screen.getByText("Level 1").closest("[data-task-id]")
      expect(level1).toHaveClass("pl-6")

      // Level 2 should have pl-12 class
      const level2 = screen.getByText("Level 2").closest("[data-task-id]")
      expect(level2).toHaveClass("pl-12")
    })

    it("keeps deeply nested hierarchy under parent status group", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "in_progress" },
        { id: "parent", title: "Parent", status: "open", parent: "grandparent" },
        { id: "child", title: "Child", status: "blocked", parent: "parent" },
        {
          id: "closed-grandchild",
          title: "Closed Grandchild",
          status: "closed",
          parent: "child",
          closed_at: new Date().toISOString(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ open: false, closed: false }}
          persistCollapsedState={false}
        />,
      )

      // All should be in Open section since root ancestor is in_progress (open status)
      expect(screen.getByLabelText("Open section, 4 tasks")).toBeInTheDocument()

      // All should be visible
      expect(screen.getByText("Grandparent")).toBeInTheDocument()
      expect(screen.getByText("Parent")).toBeInTheDocument()
      expect(screen.getByText("Child")).toBeInTheDocument()
      expect(screen.getByText("Closed Grandchild")).toBeInTheDocument()

      // Closed section should not exist
      expect(screen.queryByLabelText(/Closed section/)).not.toBeInTheDocument()
    })

    it("moves entire tree to closed when root is closed", () => {
      const tasks: TaskCardTask[] = [
        {
          id: "grandparent",
          title: "Closed Grandparent",
          status: "closed",
          closed_at: new Date().toISOString(),
        },
        {
          id: "parent",
          title: "Closed Parent",
          status: "closed",
          parent: "grandparent",
          closed_at: new Date().toISOString(),
        },
        {
          id: "child",
          title: "Closed Child",
          status: "closed",
          parent: "parent",
          closed_at: new Date().toISOString(),
        },
      ]

      render(
        <TaskList
          tasks={tasks}
          defaultCollapsed={{ closed: false }}
          persistCollapsedState={false}
        />,
      )

      // All should be in Closed section
      expect(screen.getByLabelText("Closed section, 3 tasks")).toBeInTheDocument()

      // All should be visible
      expect(screen.getByText("Closed Grandparent")).toBeInTheDocument()
      expect(screen.getByText("Closed Parent")).toBeInTheDocument()
      expect(screen.getByText("Closed Child")).toBeInTheDocument()
    })

    it("handles middle parent with children appearing as top-level when parent is open", () => {
      // This tests that a task with both parent AND children is properly nested
      const tasks: TaskCardTask[] = [
        { id: "epic", title: "Epic Task", status: "open", issue_type: "epic" },
        { id: "middle", title: "Middle Task", status: "open", parent: "epic" },
        { id: "leaf", title: "Leaf Task", status: "open", parent: "middle" },
      ]

      render(<TaskList tasks={tasks} persistCollapsedState={false} />)

      // Epic should be top level with 2 descendants
      const epicBadge = screen.getByLabelText("2 subtasks")
      expect(epicBadge).toBeInTheDocument()

      // Middle should show 1 descendant
      const middleBadge = screen.getByLabelText("1 subtask")
      expect(middleBadge).toBeInTheDocument()
    })
  })
})
