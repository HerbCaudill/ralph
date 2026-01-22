import { getOpenIssueCount } from "./getOpenIssueCount"

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
