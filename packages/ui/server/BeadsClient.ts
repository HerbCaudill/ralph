/**
 * Re-exports from @herbcaudill/beads with backward-compatible names.
 * The UI server's BeadsClient mapped to DaemonSocket, with a workspacePath → cwd adapter.
 */
import { DaemonSocket, watchMutations as sdkWatchMutations } from "@herbcaudill/beads"
import type { MutationEvent } from "@herbcaudill/beads"

/** Options for creating a BeadsClient (backward-compatible wrapper). */
export interface BeadsClientOptions {
  /** Workspace directory path (used to locate .beads/bd.sock) */
  workspacePath?: string
  /** Connection timeout in ms (default: 2000) */
  connectTimeout?: number
  /** Request timeout in ms (default: 5000) */
  requestTimeout?: number
}

/**
 * Backward-compatible wrapper around DaemonSocket.
 * Maps `workspacePath` to the SDK's `cwd` option.
 */
export class BeadsClient extends DaemonSocket {
  constructor(options: BeadsClientOptions = {}) {
    super({
      cwd: options.workspacePath,
      connectTimeout: options.connectTimeout,
      requestTimeout: options.requestTimeout,
    })
  }
}

/** Options for watching mutations (backward-compatible wrapper). */
export interface WatchMutationsOptions {
  /** Workspace path for socket location */
  workspacePath?: string
  /** Polling interval in ms (default: 1000) */
  interval?: number
  /** Initial timestamp to start watching from (default: now) */
  since?: number
}

/**
 * Backward-compatible wrapper around SDK's watchMutations.
 * Maps `workspacePath` to the SDK's `cwd` option.
 */
export function watchMutations(
  /** Callback for each mutation event */
  onMutation: (event: MutationEvent) => void,
  /** Watch options */
  options: WatchMutationsOptions = {},
): () => void {
  return sdkWatchMutations(onMutation, {
    cwd: options.workspacePath,
    interval: options.interval,
    since: options.since,
  })
}
