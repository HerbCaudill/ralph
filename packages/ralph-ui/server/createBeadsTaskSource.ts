import type { TaskSource } from "./lib/WorkerOrchestratorManager.js"

/**
 * Create a TaskSource that checks task availability from the beads-server REST API.
 * Only provides ready task count for capacity planning.
 * Agents pick and claim their own tasks at runtime.
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
  }
}
