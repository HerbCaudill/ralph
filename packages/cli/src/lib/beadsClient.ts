/**
 * Beads SDK wrappers for the CLI.
 * Implements new-issue detection by polling the issue list and diffing.
 */
import { BeadsClient } from "@herbcaudill/beads-sdk"

export { BeadsClient } from "@herbcaudill/beads-sdk"

/** Minimal mutation event shape consumed by SessionRunner. */
export interface MutationEvent {
  Type: "create"
  IssueID: string
  Title: string
}

/**
 * Poll for new issue creation events.
 * Connects a BeadsClient, snapshots existing issue IDs, then polls for new ones.
 * Returns a cleanup function.
 */
export function watchForNewIssues(
  /** Callback for each new issue event */
  onNewIssue: (issue: MutationEvent) => void,
  /** Polling interval in ms (default: 5000) */
  interval: number = 5000,
): () => void {
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const client = new BeadsClient()
  const knownIds = new Set<string>()

  async function init() {
    try {
      await client.connect(process.cwd())
      // Snapshot current issues so we only detect truly new ones
      const existing = await client.list()
      for (const issue of existing) knownIds.add(issue.id)
    } catch {
      // If we can't connect, stop silently
      return
    }
    if (!stopped) poll()
  }

  async function poll() {
    if (stopped) return
    try {
      const issues = await client.list()
      for (const issue of issues) {
        if (!knownIds.has(issue.id)) {
          knownIds.add(issue.id)
          onNewIssue({
            Type: "create",
            IssueID: issue.id,
            Title: issue.title,
          })
        }
      }
    } catch {
      // Daemon might be unavailable; skip this cycle
    }
    if (!stopped) {
      timeoutId = setTimeout(poll, interval)
    }
  }

  init()

  return () => {
    stopped = true
    if (timeoutId) clearTimeout(timeoutId)
    client.disconnect().catch(() => {})
  }
}
