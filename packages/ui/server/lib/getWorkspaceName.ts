import path from "node:path"

/**
 * Extract the workspace name from a path.
 *
 * Handles two formats:
 * - Regular workspace: `/path/to/project` → `project`
 * - Worktree workspace: `/path/to/project-worktrees/instance-id` → `project`
 *
 * Worktree paths are detected by looking for a parent directory ending in `-worktrees`.
 */
export function getWorkspaceName(workspacePath: string): string {
  const segments = workspacePath.split(path.sep)
  const lastSegment = segments.pop() || workspacePath

  // Check if this is a worktree path by looking for a parent ending in "-worktrees"
  const parentSegment = segments[segments.length - 1]
  if (parentSegment?.endsWith("-worktrees")) {
    // Extract project name from the parent (remove "-worktrees" suffix)
    return parentSegment.slice(0, -"-worktrees".length)
  }

  return lastSegment
}
