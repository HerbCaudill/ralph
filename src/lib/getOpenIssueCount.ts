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

/**
 * Calculate the default number of iterations based on open issues.
 * Returns 120% of open issues, with a minimum of 10 and maximum of 100.
 */
export const getDefaultIterations = (): number => {
  const openIssues = getOpenIssueCount()
  if (openIssues === 0) {
    return 10 // Fallback when no issues or bd not available
  }
  const calculated = Math.ceil(openIssues * 1.2)
  return Math.max(10, Math.min(100, calculated))
}
