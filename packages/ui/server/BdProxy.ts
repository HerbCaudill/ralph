/**
 * Re-exports from @herbcaudill/beads with backward-compatible names.
 * BdProxy is an alias for BeadsClient from the beads SDK.
 */
export { BeadsClient as BdProxy } from "@herbcaudill/beads"
export type { BeadsClientOptions as BdProxyOptions } from "@herbcaudill/beads"
export type { SpawnFn } from "@herbcaudill/beads"

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
} from "@herbcaudill/beads"
