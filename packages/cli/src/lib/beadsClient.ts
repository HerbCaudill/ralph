/**
 * Re-exports from @herbcaudill/beads-sdk with backward-compatible names for CLI.
 */
import {
  DaemonSocket,
  watchMutations as sdkWatchMutations,
  type MutationEvent,
} from "@herbcaudill/beads-sdk"

/** Re-export MutationEvent for backward compatibility. */
export type { MutationEvent } from "@herbcaudill/beads-sdk"

/** Re-export DaemonSocket as BeadsClient for backward compatibility. */
export { DaemonSocket as BeadsClient } from "@herbcaudill/beads-sdk"

/**
 * Poll for new issue creation events.
 * Returns a cleanup function.
 */
export function watchForNewIssues(
  /** Callback for each new issue event */
  onNewIssue: (issue: MutationEvent) => void,
  /** Polling interval in ms (default: 5000) */
  interval: number = 5000,
): () => void {
  return sdkWatchMutations(
    (event: MutationEvent) => {
      if (event.Type === "create") {
        onNewIssue(event)
      }
    },
    { interval },
  )
}
