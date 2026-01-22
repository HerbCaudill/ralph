import { execSync } from "child_process"

/**
 * Get the number of open issues from beads.
 * Returns 0 if beads is not available or there are no issues.
 */
export const getOpenIssueCount = (): number => {
  try {
    const output = execSync("bd list --status=open --json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()

    const issues = JSON.parse(output)
    return Array.isArray(issues) ? issues.length : 0
  } catch {
    return 0
  }
}
