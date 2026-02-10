import { homedir, platform } from "node:os"
import { join } from "node:path"

/**
 * Get the default storage directory for agent sessions.
 *
 * Returns a system-appropriate location that doesn't pollute the repository:
 * - Linux/macOS: ~/.local/share/ralph/agent-sessions
 * - Windows: %LOCALAPPDATA%\ralph\agent-sessions
 */
export function getDefaultStorageDir(): string {
  if (platform() === "win32") {
    // Windows: use LOCALAPPDATA
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")
    return join(localAppData, "ralph", "agent-sessions")
  }

  // Linux/macOS: use ~/.local/share following XDG Base Directory Specification
  return join(homedir(), ".local", "share", "ralph", "agent-sessions")
}
