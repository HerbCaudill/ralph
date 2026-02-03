import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** The standard filename for CLAUDE.md configuration files. */
export const CLAUDE_MD_FILENAME = "CLAUDE.md"

/** Options for loading CLAUDE.md files. */
export interface LoadClaudeMdOptions {
  /** Working directory to search for workspace CLAUDE.md. Defaults to process.cwd(). */
  cwd?: string
}

/**
 * Load CLAUDE.md content from user global and workspace locations.
 *
 * Checks two locations in order:
 * 1. User global: ~/.claude/CLAUDE.md
 * 2. Workspace: {cwd}/CLAUDE.md
 *
 * If both exist, their contents are combined with the global config first,
 * followed by workspace config (separated by a blank line).
 *
 * @returns The combined CLAUDE.md content, or null if no files exist.
 */
export function loadClaudeMdSync(options: LoadClaudeMdOptions = {}): string | null {
  const { cwd = process.cwd() } = options
  const contents: string[] = []

  // 1. User global: ~/.claude/CLAUDE.md
  const globalPath = join(homedir(), ".claude", CLAUDE_MD_FILENAME)
  const globalContent = readFileSafe(globalPath)
  if (globalContent) {
    contents.push(globalContent)
  }

  // 2. Workspace: {cwd}/CLAUDE.md
  const workspacePath = join(cwd, CLAUDE_MD_FILENAME)
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
 * Async version of loadClaudeMdSync.
 *
 * Currently wraps the sync version since file operations are fast,
 * but provides an async interface for future optimization if needed.
 */
export async function loadClaudeMd(options: LoadClaudeMdOptions = {}): Promise<string | null> {
  return loadClaudeMdSync(options)
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
