import path from "node:path"
import { getAliveWorkspaces } from "@herbcaudill/beads-sdk/node"
import { findSiblingBeadsWorkspaces } from "./findSiblingBeadsWorkspaces.js"

/** Get workspaces from the registry and local sibling Beads repositories. */
export function discoverWorkspaces(): Array<{ path: string; name: string }> {
  const workspaces = new Map<string, { path: string; name: string }>()

  for (const workspace of getAliveWorkspaces()) {
    workspaces.set(path.resolve(workspace.path), workspace)
  }

  for (const workspacePath of findSiblingBeadsWorkspaces(process.env.WORKSPACE_PATH)) {
    workspaces.set(path.resolve(workspacePath), {
      path: workspacePath,
      name: path.basename(workspacePath),
    })
  }

  return [...workspaces.values()]
}
