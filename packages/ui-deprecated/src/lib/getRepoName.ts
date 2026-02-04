/**
 * Extract the repository name from a workspace path.
 *
 * Handles two formats:
 * - Regular workspace: `/path/to/project` → `project`
 * - Worktree workspace: `/path/to/project-worktrees/instance-id` → `project`
 *
 * Worktree paths are detected by looking for a parent directory ending in `-worktrees`.
 */
export function getRepoName(workspace: string | null): string | null {
  if (!workspace) return null

  const segments = workspace.split("/")
  const lastSegment = segments.pop() || workspace

  // Check if this is a worktree path by looking for a parent ending in "-worktrees"
  const parentSegment = segments[segments.length - 1]
  if (parentSegment?.endsWith("-worktrees")) {
    // Extract project name from the parent (remove "-worktrees" suffix)
    return parentSegment.slice(0, -"-worktrees".length)
  }

  return lastSegment
}
