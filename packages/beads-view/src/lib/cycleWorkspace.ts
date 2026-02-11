import type { Workspace } from "../hooks/useWorkspace"

/**
 * Get the next or previous workspace in the list, wrapping around at the ends.
 * Returns null if there are fewer than 2 workspaces or no current workspace.
 */
export function cycleWorkspace(
  /** The list of available workspaces */
  workspaces: Workspace[],
  /** The currently selected workspace */
  current: Workspace | null,
  /** The direction to cycle */
  direction: "next" | "previous",
): Workspace | null {
  if (workspaces.length < 2 || !current) return null

  const currentIndex = workspaces.findIndex(ws => ws.path === current.path)
  if (currentIndex === -1) return null

  const offset = direction === "next" ? 1 : -1
  const nextIndex = (currentIndex + offset + workspaces.length) % workspaces.length
  return workspaces[nextIndex]
}
