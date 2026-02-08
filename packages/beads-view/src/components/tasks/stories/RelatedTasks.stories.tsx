import { useEffect, useRef } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelatedTasks } from "../RelatedTasks"
import { configureApiClient } from "../../../lib/apiClient"
import type { TaskCardTask } from "../../../types"

const meta: Meta<typeof RelatedTasks> = {
  title: "Collections/RelatedTasks",
  component: RelatedTasks,
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// ---- Realistic task data

const currentTask: TaskCardTask = {
  id: "proj-42",
  title: "Implement user authentication flow",
  status: "in_progress",
  priority: 1,
  issue_type: "feature",
  parent: "proj-10",
}

const childTasks: TaskCardTask[] = [
  {
    id: "proj-43",
    title: "Add login form component",
    status: "closed",
    priority: 2,
    issue_type: "task",
    parent: "proj-42",
    closed_at: "2026-02-05T10:00:00Z",
  },
  {
    id: "proj-44",
    title: "Implement JWT token refresh",
    status: "in_progress",
    priority: 1,
    issue_type: "task",
    parent: "proj-42",
  },
  {
    id: "proj-45",
    title: "Add password reset email template",
    status: "open",
    priority: 2,
    issue_type: "task",
    parent: "proj-42",
  },
  {
    id: "proj-46",
    title: "Write auth middleware tests",
    status: "open",
    priority: 2,
    issue_type: "task",
    parent: "proj-42",
  },
]

const blockerTasks: TaskCardTask[] = [
  {
    id: "proj-30",
    title: "Set up PostgreSQL connection pool",
    status: "in_progress",
    priority: 1,
    issue_type: "task",
  },
  {
    id: "proj-31",
    title: "Define user schema and migrations",
    status: "open",
    priority: 0,
    issue_type: "task",
  },
]

const dependentTasks: TaskCardTask[] = [
  {
    id: "proj-60",
    title: "Build user profile page",
    status: "blocked",
    priority: 2,
    issue_type: "feature",
  },
  {
    id: "proj-61",
    title: "Add role-based access control",
    status: "open",
    priority: 1,
    issue_type: "feature",
  },
  {
    id: "proj-62",
    title: "Implement session analytics",
    status: "open",
    priority: 3,
    issue_type: "task",
  },
]

const otherTasks: TaskCardTask[] = [
  {
    id: "proj-10",
    title: "User management epic",
    status: "in_progress",
    priority: 1,
    issue_type: "epic",
  },
  {
    id: "proj-11",
    title: "Set up CI/CD pipeline",
    status: "closed",
    priority: 1,
    issue_type: "task",
    closed_at: "2026-01-20T10:00:00Z",
  },
  {
    id: "proj-12",
    title: "Configure ESLint and Prettier",
    status: "closed",
    priority: 3,
    issue_type: "task",
    closed_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "proj-20",
    title: "Design API rate limiting strategy",
    status: "open",
    priority: 2,
    issue_type: "task",
  },
  {
    id: "proj-21",
    title: "Add request logging middleware",
    status: "open",
    priority: 3,
    issue_type: "task",
  },
  {
    id: "proj-22",
    title: "Implement WebSocket connection manager",
    status: "in_progress",
    priority: 1,
    issue_type: "feature",
  },
  {
    id: "proj-23",
    title: "Fix CORS headers for staging environment",
    status: "open",
    priority: 0,
    issue_type: "bug",
  },
  {
    id: "proj-24",
    title: "Add health check endpoint",
    status: "closed",
    priority: 3,
    issue_type: "task",
    closed_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "proj-25",
    title: "Migrate to Node 22 LTS",
    status: "deferred",
    priority: 4,
    issue_type: "task",
  },
  {
    id: "proj-26",
    title: "Add OpenTelemetry tracing",
    status: "open",
    priority: 2,
    issue_type: "feature",
  },
  {
    id: "proj-27",
    title: "Write integration tests for payment flow",
    status: "open",
    priority: 1,
    issue_type: "task",
  },
  {
    id: "proj-28",
    title: "Optimize database query for dashboard",
    status: "open",
    priority: 2,
    issue_type: "bug",
  },
  {
    id: "proj-29",
    title: "Update dependency versions",
    status: "open",
    priority: 4,
    issue_type: "chore",
  },
]

const allTasks: TaskCardTask[] = [
  currentTask,
  ...childTasks,
  ...blockerTasks,
  ...dependentTasks,
  ...otherTasks,
]

/** Creates a mock fetch function that returns the given blockers/dependents for the task endpoint. */
function createMockFetch(
  /** Current blocker IDs (mutable — add/remove endpoints modify this) */
  blockerIds: Set<string>,
) {
  const taskById = new Map(allTasks.map(t => [t.id, t]))

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString()

    // GET /api/tasks/:id — return task with dependencies/dependents
    const taskMatch = url.match(/\/api\/tasks\/([\w-]+)(?:\?|$)/)
    if (taskMatch && (!init?.method || init.method === "GET")) {
      const dependencies = [...blockerIds]
        .map(id => taskById.get(id))
        .filter(Boolean)
        .map(t => ({
          id: t!.id,
          title: t!.title,
          status: t!.status,
          dependency_type: "blocks",
        }))

      const dependents = dependentTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dependency_type: "blocks",
      }))

      return new Response(
        JSON.stringify({
          ok: true,
          issue: { dependencies, dependents },
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }

    // POST /api/tasks/:id/blockers — add a blocker
    const addMatch = url.match(/\/api\/tasks\/[\w-]+\/blockers(?:\?|$)/)
    if (addMatch && init?.method === "POST") {
      const body = JSON.parse(init.body as string)
      blockerIds.add(body.blockerId)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // DELETE /api/tasks/:id/blockers/:blockerId — remove a blocker
    const removeMatch = url.match(/\/api\/tasks\/[\w-]+\/blockers\/([\w-]+)/)
    if (removeMatch && init?.method === "DELETE") {
      blockerIds.delete(removeMatch[1])
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: false, error: "Not found" }), { status: 404 })
  }
}

/** Story decorator that configures the API client with a mock fetch. */
function MockApiDecorator({
  children,
  initialBlockerIds,
}: {
  children: React.ReactNode
  initialBlockerIds: string[]
}) {
  // Configure API client synchronously on first render so child components
  // can fetch dependencies immediately without waiting for useEffect
  const blockerIdsRef = useRef<Set<string>>(new Set(initialBlockerIds))

  // Configure on first render (synchronously)
  const isConfigured = useRef(false)
  if (!isConfigured.current) {
    configureApiClient({ fetchFn: createMockFetch(blockerIdsRef.current) as typeof fetch })
    isConfigured.current = true
  }

  // Clean up on unmount
  useEffect(() => {
    return () => configureApiClient({})
  }, [])

  return <>{children}</>
}

export const Default: Story = {
  render: () => (
    <MockApiDecorator initialBlockerIds={blockerTasks.map(t => t.id)}>
      <RelatedTasks taskId="proj-42" task={currentTask} allTasks={allTasks} issuePrefix="proj" />
    </MockApiDecorator>
  ),
}

export const ReadOnly: Story = {
  render: () => (
    <MockApiDecorator initialBlockerIds={blockerTasks.map(t => t.id)}>
      <RelatedTasks
        taskId="proj-42"
        task={currentTask}
        allTasks={allTasks}
        issuePrefix="proj"
        readOnly
      />
    </MockApiDecorator>
  ),
}

export const NoRelationships: Story = {
  render: () => {
    const standalone: TaskCardTask = {
      id: "proj-99",
      title: "Standalone task with no relationships",
      status: "open",
      priority: 2,
    }
    return (
      <MockApiDecorator initialBlockerIds={[]}>
        <RelatedTasks
          taskId="proj-99"
          task={standalone}
          allTasks={[standalone, ...otherTasks]}
          issuePrefix="proj"
        />
      </MockApiDecorator>
    )
  },
}
