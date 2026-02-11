import type { TaskSource, ReadyTask } from "@herbcaudill/agent-server"

/**
 * Create a TaskSource that fetches tasks from the beads-server REST API.
 */
export function createBeadsTaskSource(
  /** Base URL of the beads server (e.g., "http://localhost:4243"). */
  beadsServerUrl: string,
  /** Workspace path or ID to pass as the `workspace` query parameter. */
  workspace: string,
): TaskSource {
  const ws = encodeURIComponent(workspace)

  return {
    async getReadyTasksCount(): Promise<number> {
      const res = await fetch(`${beadsServerUrl}/api/tasks?ready=true&workspace=${ws}`)
      if (!res.ok) return 0
      const data = (await res.json()) as { issues?: unknown[] }
      return data.issues?.length ?? 0
    },

    async getReadyTask(workerName: string): Promise<ReadyTask | null> {
      const res = await fetch(`${beadsServerUrl}/api/tasks?ready=true&workspace=${ws}`)
      if (!res.ok) return null
      const data = (await res.json()) as { issues?: Array<{ id: string; title: string; assignee?: string }> }
      const issues = data.issues ?? []
      // Pick the first task that is unassigned or already assigned to this worker
      const task = issues.find(t => !t.assignee || t.assignee === workerName)
      if (!task) return null
      return { id: task.id, title: task.title }
    },

    async claimTask(taskId: string, workerName: string): Promise<void> {
      await fetch(`${beadsServerUrl}/api/tasks/${taskId}?workspace=${ws}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress", assignee: workerName }),
      })
    },

    async closeTask(taskId: string): Promise<void> {
      await fetch(`${beadsServerUrl}/api/tasks/${taskId}?workspace=${ws}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      })
    },
  }
}
