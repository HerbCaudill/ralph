import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskList } from "./TaskList"
import type { TaskCardTask } from "./TaskCard"
import { fn } from "storybook/test"

const meta: Meta<typeof TaskList> = {
  title: "Tasks/TaskList",
  component: TaskList,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border h-[500px] max-w-md overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
  args: {
    onStatusChange: fn(),
    onTaskClick: fn(),
    persistCollapsedState: false, // Disable persistence in stories
  },
}

export default meta
type Story = StoryObj<typeof meta>

const mixedTasks: TaskCardTask[] = [
  { id: "rui-001", title: "Implement login page", status: "in_progress", priority: 1 },
  { id: "rui-002", title: "Add unit tests for auth", status: "open", priority: 2 },
  { id: "rui-003", title: "Fix navigation bug", status: "blocked", priority: 0 },
  { id: "rui-004", title: "Update API documentation", status: "open", priority: 3 },
  { id: "rui-005", title: "Refactor API client", status: "closed", priority: 2 },
  { id: "rui-006", title: "Setup CI/CD pipeline", status: "open", priority: 1 },
  { id: "rui-007", title: "Database schema migration", status: "deferred", priority: 2 },
  { id: "rui-008", title: "Performance optimization", status: "blocked", priority: 1 },
]

export const Default: Story = {
  args: {
    tasks: mixedTasks,
  },
}

export const AllGroupsExpanded: Story = {
  args: {
    tasks: mixedTasks,
    defaultCollapsed: {
      ready: false,
      in_progress: false,
      blocked: false,
      closed: false,
    },
  },
}

export const AllGroupsCollapsed: Story = {
  args: {
    tasks: mixedTasks,
    defaultCollapsed: {
      ready: true,
      in_progress: true,
      blocked: true,
      closed: true,
    },
  },
}

export const OnlyOpenTasks: Story = {
  args: {
    tasks: mixedTasks.filter(t => t.status === "open"),
  },
}

export const OnlyInProgress: Story = {
  args: {
    tasks: mixedTasks.filter(t => t.status === "in_progress"),
  },
}

export const OnlyBlocked: Story = {
  args: {
    tasks: mixedTasks.filter(t => t.status === "blocked"),
  },
}

export const OnlyClosed: Story = {
  args: {
    tasks: mixedTasks.filter(t => t.status === "closed"),
  },
}

export const Empty: Story = {
  args: {
    tasks: [],
  },
}

export const ShowEmptyGroups: Story = {
  args: {
    tasks: [
      { id: "rui-001", title: "Single in progress task", status: "in_progress", priority: 1 },
    ],
    showEmptyGroups: true,
    defaultCollapsed: {
      ready: false,
      in_progress: false,
      blocked: false,
      closed: false,
    },
  },
}

export const ManyTasks: Story = {
  args: {
    tasks: Array.from({ length: 20 }, (_, i) => ({
      id: `rui-${String(i).padStart(3, "0")}`,
      title: `Task ${i + 1}: ${["Implement feature", "Fix bug", "Write tests", "Update docs", "Refactor code"][i % 5]}`,
      status: (["open", "in_progress", "blocked", "closed", "deferred"] as const)[i % 5],
      priority: (i % 5) as 0 | 1 | 2 | 3 | 4,
    })),
  },
}

export const WithDescriptions: Story = {
  args: {
    tasks: [
      {
        id: "rui-001",
        title: "Setup authentication",
        status: "in_progress",
        priority: 1,
        description: "Configure OAuth2 with Google and GitHub providers",
        issue_type: "epic",
      },
      {
        id: "rui-002",
        title: "Add login form",
        status: "open",
        priority: 2,
        description: "Create responsive login form with validation",
        parent: "rui-001",
        issue_type: "task",
      },
      {
        id: "rui-003",
        title: "Waiting for API docs",
        status: "blocked",
        priority: 1,
        description: "Cannot proceed until backend team provides API documentation",
        issue_type: "task",
      },
    ],
  },
}

/**
 * Demonstrates the epic grouping feature.
 * Tasks with a parent epic are grouped under their epic.
 * Tasks without an epic are shown in status groups below.
 */
export const GroupedByEpic: Story = {
  args: {
    tasks: [
      // Epic 1: Authentication
      {
        id: "rui-auth",
        title: "User authentication",
        status: "in_progress",
        priority: 1,
        issue_type: "epic",
        description: "Implement complete user authentication flow",
      },
      {
        id: "rui-auth.1",
        title: "Login form",
        status: "closed",
        priority: 2,
        parent: "rui-auth",
        issue_type: "task",
      },
      {
        id: "rui-auth.2",
        title: "OAuth integration",
        status: "in_progress",
        priority: 1,
        parent: "rui-auth",
        issue_type: "task",
      },
      {
        id: "rui-auth.3",
        title: "Password reset flow",
        status: "open",
        priority: 2,
        parent: "rui-auth",
        issue_type: "task",
      },
      // Epic 2: Dashboard
      {
        id: "rui-dash",
        title: "Dashboard redesign",
        status: "open",
        priority: 2,
        issue_type: "epic",
        description: "Modernize the dashboard with new widgets",
      },
      {
        id: "rui-dash.1",
        title: "Analytics widget",
        status: "open",
        priority: 2,
        parent: "rui-dash",
        issue_type: "task",
      },
      {
        id: "rui-dash.2",
        title: "Activity feed",
        status: "blocked",
        priority: 3,
        parent: "rui-dash",
        issue_type: "task",
      },
      // Ungrouped tasks (no parent epic)
      {
        id: "rui-fix-1",
        title: "Fix navigation bug",
        status: "open",
        priority: 0,
        issue_type: "bug",
      },
      {
        id: "rui-fix-2",
        title: "Update API documentation",
        status: "open",
        priority: 3,
        issue_type: "task",
      },
      {
        id: "rui-fix-3",
        title: "Performance optimization",
        status: "in_progress",
        priority: 1,
        issue_type: "task",
      },
    ],
  },
}

/**
 * Shows only epic-grouped tasks with no ungrouped items.
 */
export const OnlyEpicTasks: Story = {
  args: {
    tasks: [
      {
        id: "rui-epic-1",
        title: "Server foundation",
        status: "closed",
        priority: 2,
        issue_type: "epic",
      },
      {
        id: "rui-epic-1.1",
        title: "Set up Express server",
        status: "closed",
        priority: 2,
        parent: "rui-epic-1",
        issue_type: "task",
      },
      {
        id: "rui-epic-1.2",
        title: "WebSocket support",
        status: "closed",
        priority: 2,
        parent: "rui-epic-1",
        issue_type: "task",
      },
      {
        id: "rui-epic-2",
        title: "React shell",
        status: "in_progress",
        priority: 2,
        issue_type: "epic",
      },
      {
        id: "rui-epic-2.1",
        title: "Set up Vite + React",
        status: "closed",
        priority: 2,
        parent: "rui-epic-2",
        issue_type: "task",
      },
      {
        id: "rui-epic-2.2",
        title: "Create main layout",
        status: "in_progress",
        priority: 2,
        parent: "rui-epic-2",
        issue_type: "task",
      },
    ],
  },
}

export const PrioritySorting: Story = {
  args: {
    tasks: [
      { id: "rui-004", title: "P4 Low priority task", status: "open", priority: 4 },
      { id: "rui-001", title: "P1 High priority task", status: "open", priority: 1 },
      { id: "rui-000", title: "P0 Critical task", status: "open", priority: 0 },
      { id: "rui-002", title: "P2 Medium priority task", status: "open", priority: 2 },
      { id: "rui-003", title: "P3 Normal priority task", status: "open", priority: 3 },
    ],
    defaultCollapsed: {
      ready: false,
    },
  },
}

export const WithoutStatusHandler: Story = {
  args: {
    tasks: mixedTasks.slice(0, 3),
    onStatusChange: undefined,
  },
}

/**
 * Demonstrates epics with no subtasks.
 * Epics without subtasks don't show the collapse/expand chevron or task count.
 */
export const EpicsWithNoSubtasks: Story = {
  args: {
    tasks: [
      // Epic with subtasks - shows chevron and count
      {
        id: "rui-with-tasks",
        title: "Epic with tasks",
        status: "in_progress",
        priority: 1,
        issue_type: "epic",
      },
      {
        id: "rui-with-tasks.1",
        title: "Child task 1",
        status: "open",
        priority: 2,
        parent: "rui-with-tasks",
        issue_type: "task",
      },
      {
        id: "rui-with-tasks.2",
        title: "Child task 2",
        status: "in_progress",
        priority: 2,
        parent: "rui-with-tasks",
        issue_type: "task",
      },
      // Epic without subtasks - no chevron or count
      {
        id: "rui-empty-1",
        title: "Empty epic (no collapse UI)",
        status: "open",
        priority: 2,
        issue_type: "epic",
      },
      // Another epic without subtasks
      {
        id: "rui-empty-2",
        title: "Another empty epic",
        status: "open",
        priority: 3,
        issue_type: "epic",
      },
    ],
  },
}
