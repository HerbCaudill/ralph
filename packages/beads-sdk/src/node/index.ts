/** Node-only exports for beads-sdk (transport, client, registry, discovery). */

export { BeadsClient, watchMutations } from "../client.js"
export type { BeadsClientOptions } from "../client.js"

export { DaemonTransport } from "../transport/daemon.js"
export type { DaemonTransportOptions } from "../transport/daemon.js"

export { JsonlTransport } from "../transport/jsonl.js"

export { findSocketPath, findJsonlPath, findBeadsDir } from "../transport/discovery.js"

export {
  getRegistryPath,
  readRegistry,
  getAvailableWorkspaces,
  isProcessRunning,
  getAliveWorkspaces,
} from "../registry.js"
