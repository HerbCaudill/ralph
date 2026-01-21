export function getRepoName(workspace: string | null): string | null {
  if (!workspace) return null
  return workspace.split("/").pop() || workspace
}
