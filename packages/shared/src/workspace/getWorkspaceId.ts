/**
 * Extract an `owner/repo` workspace identifier from a git remote URL or filesystem path.
 *
 * Prefers git remote URL when available. Falls back to the last two segments of the
 * filesystem path. The result is always lowercased for consistency.
 */
export function getWorkspaceId(
  /** Options providing git remote URL and/or filesystem path */
  options: GetWorkspaceIdOptions,
): string {
  const { gitRemoteUrl, workspacePath } = options

  if (gitRemoteUrl) {
    const fromRemote = extractFromGitRemote(gitRemoteUrl)
    if (fromRemote) return fromRemote
  }

  if (workspacePath) {
    return extractFromPath(workspacePath)
  }

  return "unknown"
}

/**
 * Extract `owner/repo` from a git remote URL.
 *
 * Handles HTTPS URLs (`https://github.com/owner/repo.git`) and
 * SSH URLs (`git@github.com:owner/repo.git`). For nested groups
 * (e.g. GitLab `org/group/subgroup/project`), uses the first and last segments.
 */
function extractFromGitRemote(
  /** Git remote URL (HTTPS or SSH format) */
  url: string,
): string | null {
  // SSH format: git@host:owner/repo.git
  const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return normalizeOwnerRepo(sshMatch[1])
  }

  // HTTPS format: https://host/owner/repo.git
  const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/)
  if (httpsMatch) {
    return normalizeOwnerRepo(httpsMatch[1])
  }

  return null
}

/**
 * Normalize a path like `owner/repo` or `org/group/subgroup/project` to `owner/repo`.
 * For nested paths, uses the first and last segments.
 */
function normalizeOwnerRepo(
  /** Path portion from the git URL (e.g. `owner/repo` or `org/group/project`) */
  pathPart: string,
): string {
  const segments = pathPart.split("/").filter(Boolean)
  if (segments.length === 0) return ""
  if (segments.length === 1) return segments[0].toLowerCase()

  const owner = segments[0]
  const repo = segments[segments.length - 1]
  return `${owner}/${repo}`.toLowerCase()
}

/**
 * Extract a workspace identifier from a filesystem path.
 * Uses the last two segments as `parent/name`, or just the last segment if the path is short.
 */
function extractFromPath(
  /** Filesystem path to the workspace */
  fsPath: string,
): string {
  const segments = fsPath.split("/").filter(Boolean)
  if (segments.length === 0) return "unknown"
  if (segments.length === 1) return segments[0].toLowerCase()

  const parent = segments[segments.length - 2]
  const name = segments[segments.length - 1]
  return `${parent}/${name}`.toLowerCase()
}

/** Options for getWorkspaceId. */
export interface GetWorkspaceIdOptions {
  /** Git remote URL (preferred source). */
  gitRemoteUrl?: string
  /** Filesystem path to the workspace (fallback). */
  workspacePath?: string
}
