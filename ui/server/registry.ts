import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Entry stored in the beads registry file (~/.beads/registry.json).
 */
export interface RegistryEntry {
  workspace_path: string
  socket_path: string
  database_path: string
  pid: number
  version: string
  started_at: string
}

/**
 * Workspace info with additional metadata for the UI.
 */
export interface WorkspaceInfo {
  path: string
  name: string
  database: string
  pid: number
  version: string
  startedAt: string
  isActive?: boolean
}

/**
 * Get the path to the global beads registry file.
 */
export function getRegistryPath(): string {
  return path.join(os.homedir(), ".beads", "registry.json")
}

/**
 * Read and parse the registry file.
 * Returns an array of registry entries, or empty array if file doesn't exist or is invalid.
 */
export function readRegistry(): RegistryEntry[] {
  const registryPath = getRegistryPath()
  try {
    const content = fs.readFileSync(registryPath, "utf8")
    const data = JSON.parse(content) as unknown
    if (Array.isArray(data)) {
      return data as RegistryEntry[]
    }
    return []
  } catch {
    return []
  }
}

/**
 * Get all available workspaces from the registry file.
 * Optionally marks the active workspace (based on currentPath).
 */
export function getAvailableWorkspaces(currentPath?: string): WorkspaceInfo[] {
  const entries = readRegistry()
  return entries.map(entry => ({
    path: entry.workspace_path,
    name: path.basename(entry.workspace_path),
    database: entry.database_path,
    pid: entry.pid,
    version: entry.version,
    startedAt: entry.started_at,
    isActive:
      currentPath ? path.resolve(currentPath) === path.resolve(entry.workspace_path) : false,
  }))
}

/**
 * Check if a specific process is still running.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Get available workspaces, filtering out those with dead daemon processes.
 */
export function getAliveWorkspaces(currentPath?: string): WorkspaceInfo[] {
  return getAvailableWorkspaces(currentPath).filter(ws => isProcessRunning(ws.pid))
}
