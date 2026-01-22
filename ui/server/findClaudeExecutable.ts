import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Try to find the Claude Code executable in common locations.
 * Returns the path if found, undefined otherwise.
 */
export function findClaudeExecutable(): string | undefined {
  const home = homedir()

  /** Common installation paths for Claude Code */
  const candidates = [
    join(home, ".local", "bin", "claude"), // Linux/macOS npm global
    join(home, ".claude", "local", "claude"), // Native installer location
    "/usr/local/bin/claude", // System-wide installation
    "/opt/homebrew/bin/claude", // Homebrew on Apple Silicon
    "/usr/bin/claude", // Linux system
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}
