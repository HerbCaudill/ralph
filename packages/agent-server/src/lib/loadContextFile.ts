import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** Supported adapter types for context file loading. */
export type AdapterType = "claude" | "codex" | string

/** Map of adapter IDs to their context file names and global config directories. */
const ADAPTER_CONFIG: Record<string, { filename: string; globalDir: string }> = {
  claude: { filename: "CLAUDE.md", globalDir: ".claude" },
  codex: { filename: "AGENTS.md", globalDir: ".codex" },
}

/** Get the default config (Claude) for unknown adapters. */
const DEFAULT_CONFIG = ADAPTER_CONFIG.claude

/**
 * Get the context filename for a given adapter.
 *
 * @param adapter - The adapter type (e.g., "claude", "codex")
 * @returns The filename to look for (e.g., "CLAUDE.md", "AGENTS.md")
 */
export function getContextFilename(adapter: AdapterType): string {
  return (ADAPTER_CONFIG[adapter] ?? DEFAULT_CONFIG).filename
}

/**
 * Get the global config directory for a given adapter.
 *
 * @param adapter - The adapter type (e.g., "claude", "codex")
 * @returns The global config directory name (e.g., ".claude", ".codex")
 */
export function getGlobalConfigDir(adapter: AdapterType): string {
  return (ADAPTER_CONFIG[adapter] ?? DEFAULT_CONFIG).globalDir
}

/** Options for loading context files. */
export interface LoadContextFileOptions {
  /** Working directory to search for workspace context file. Defaults to process.cwd(). */
  cwd?: string
  /** Adapter type to determine which context file to load. Defaults to "claude". */
  adapter?: AdapterType
}

/**
 * Load context file content from user global and workspace locations.
 *
 * Checks two locations in order:
 * 1. User global: ~/{globalDir}/{filename} (e.g., ~/.claude/CLAUDE.md)
 * 2. Workspace: {cwd}/{filename} (e.g., /project/CLAUDE.md)
 *
 * If both exist, their contents are combined with the global config first,
 * followed by workspace config (separated by a blank line).
 *
 * @param options - Loading options
 * @returns The combined context file content, or null if no files exist.
 */
export function loadContextFileSync(options: LoadContextFileOptions = {}): string | null {
  const { cwd = process.cwd(), adapter = "claude" } = options
  const filename = getContextFilename(adapter)
  const globalDir = getGlobalConfigDir(adapter)
  const contents: string[] = []

  // 1. User global: ~/{globalDir}/{filename}
  const globalPath = join(homedir(), globalDir, filename)
  const globalContent = readFileSafe(globalPath)
  if (globalContent) {
    contents.push(globalContent)
  }

  // 2. Workspace: {cwd}/{filename}
  const workspacePath = join(cwd, filename)
  const workspaceContent = readFileSafe(workspacePath)
  if (workspaceContent) {
    contents.push(workspaceContent)
  }

  if (contents.length === 0) {
    return null
  }

  return contents.join("\n\n")
}

/**
 * Async version of loadContextFileSync.
 *
 * Currently wraps the sync version since file operations are fast,
 * but provides an async interface for future optimization if needed.
 */
export async function loadContextFile(options: LoadContextFileOptions = {}): Promise<string | null> {
  return loadContextFileSync(options)
}

/**
 * Safely read a file's content, returning null if the file doesn't exist
 * or if there's an error reading it.
 */
function readFileSafe(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }
    const content = readFileSync(filePath, "utf-8").trim()
    return content.length > 0 ? content : null
  } catch {
    return null
  }
}
