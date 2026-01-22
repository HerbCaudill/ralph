/**
 * Check if a specific process is still running.
 */
export function isProcessRunning(
  /** The process ID to check */
  pid: number,
): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
