/**
 * Re-exports beads domain types from @herbcaudill/beads for backward compatibility.
 * The canonical types now live in the @herbcaudill/beads package.
 */
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
