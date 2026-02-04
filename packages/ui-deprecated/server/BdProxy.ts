/**
 * Re-exports from @herbcaudill/beads-sdk with backward-compatible names.
 * BdProxy is an alias for BeadsClient from the beads SDK.
 */
export { BeadsClient as BdProxy } from "@herbcaudill/beads-sdk"
export type { BeadsClientOptions as BdProxyOptions } from "@herbcaudill/beads-sdk"
export type { SpawnFn } from "@herbcaudill/beads-sdk"

export type {
  IssueStatus,
  BdIssue,
  BdDependency,
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
  BdInfo,
  BdLabelResult,
  BdDepResult,
  BdComment,
  MutationType,
  MutationEvent,
} from "@herbcaudill/beads-sdk"
