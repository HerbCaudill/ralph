import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

/** Find Beads workspaces next to the current workspace path. */
export function findSiblingBeadsWorkspaces(
  /** Current workspace path used as the discovery anchor. */
  workspacePath?: string,
): string[] {
  if (!workspacePath || !existsSync(path.join(workspacePath, ".beads"))) return []

  const discovered = new Map<string, string>()
  discovered.set(path.resolve(workspacePath), workspacePath)

  try {
    const parentPath = path.dirname(workspacePath)
    const entries = readdirSync(parentPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(parentPath, entry.name))
      .filter(candidate => existsSync(path.join(candidate, ".beads")))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

    for (const candidate of entries) {
      discovered.set(path.resolve(candidate), candidate)
    }
  } catch {
    return [...discovered.values()]
  }

  return [...discovered.values()]
}
