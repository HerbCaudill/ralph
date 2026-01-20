/**
 * Convert an absolute file path to a relative path if it's within the workspace.
 * Returns the original path if workspace is null or the path is not within the workspace.
 */
export function toRelativePath(absolutePath: string, workspace: string | null): string {
  if (!workspace) return absolutePath

  // Normalize workspace path to ensure it ends with a slash
  const normalizedWorkspace = workspace.endsWith("/") ? workspace : `${workspace}/`

  // If path starts with workspace path, strip it
  if (absolutePath.startsWith(normalizedWorkspace)) {
    return absolutePath.slice(normalizedWorkspace.length)
  }

  // Also handle case where path doesn't have leading slash but workspace does
  const workspaceWithoutSlash = normalizedWorkspace.replace(/^\//, "")
  if (absolutePath.startsWith(workspaceWithoutSlash)) {
    return absolutePath.slice(workspaceWithoutSlash.length)
  }

  return absolutePath
}
