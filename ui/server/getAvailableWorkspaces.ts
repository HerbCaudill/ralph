import path from "node:path"
import { readRegistry } from "./readRegistry.js"
import { type RegistryEntry, type WorkspaceInfo } from "./types.js"

/**
 * Get all available workspaces from the registry file.
 * Optionally marks the active workspace (based on currentPath).
 */
export function getAvailableWorkspaces(currentPath?: string): WorkspaceInfo[] {
  const entries = readRegistry()
  return entries.map((entry: RegistryEntry) => ({
      path: entry.workspace_path,
      name: path.basename(entry.workspace_path),
      database: entry.database_path,
      pid: entry.pid,
      version: entry.version,
      startedAt: entry.started_at,
      isActive:
        currentPath ? path.resolve(currentPath) === path.resolve(entry.workspace_path) : false,
    }),
  )
}
