/**
 * Browser-safe exports for beads-sdk.
 * Node-only modules (transports, client, registry, discovery) are available
 * via `@herbcaudill/beads-sdk/node`.
 */

export type {
  Status,
  Priority,
  IssueType,
  DepType,
  Issue,
  LinkedIssue,
  BlockedIssue,
  StatsSummary,
  RecentActivity,
  Stats,
  HealthStatus,
  ListFilter,
  ReadyFilter,
  BlockedFilter,
  CreateInput,
  UpdateInput,
  Transport,
  RawJsonlDependency,
  RawJsonlIssue,
  Comment,
  LabelResult,
  DepResult,
  Info,
  MutationType,
  MutationEvent,
  RegistryEntry,
  WorkspaceInfo,
} from "./types.js"

export { ChangePoller } from "./poller.js"

export { MutationPoller } from "./mutation-poller.js"
export type { WatchMutationsOptions } from "./mutation-poller.js"

export { batched, MAX_CONCURRENT_REQUESTS } from "./batch.js"

export { getWorkspaceId } from "./getWorkspaceId.js"
export type { GetWorkspaceIdOptions } from "./getWorkspaceId.js"
