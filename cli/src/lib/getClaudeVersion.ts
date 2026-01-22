import { execSync } from "child_process"

/**
 * Get the installed Claude CLI version by executing `claude --version`.
 * Returns the version string (e.g., "2.1.5") or "unknown" if unable to determine.
 */
export const getClaudeVersion = (): string => {
  try {
    const output = execSync("claude --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()

    // Output format: "2.1.5 (Claude Code)"
    // Extract the version number
    const match = output.match(/^([\d.]+)/)
    return match ? match[1] : "unknown"
  } catch {
    return "unknown"
  }
}
