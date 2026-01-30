/**
 * Parse instance name and ID from a worktree branch name.
 *
 * Expected format: {name}-{id}
 * The last dash separates name from ID.
 */
export function parseWorktreeFromBranch(
  /** Branch name without the "ralph/" prefix */
  branchParts: string,
): { instanceName: string; instanceId: string } | null {
  // Parse {name}-{id} from branch name
  const lastDash = branchParts.lastIndexOf("-")
  if (lastDash > 0) {
    const instanceName = branchParts.slice(0, lastDash)
    const instanceId = branchParts.slice(lastDash + 1)
    return { instanceName, instanceId }
  }
  return null
}
