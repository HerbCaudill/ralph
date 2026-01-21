/**
 * Beads Domain Types
 *
 * This module provides the shared types for interacting with the beads
 * issue tracking system. These types are used by both the CLI and UI
 * packages to ensure consistency.
 */

export type {
  // Issue types
  IssueStatus,
  BdIssue,
  BdDependency,
  // Option types
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
  // Info and result types
  BdInfo,
  BdLabelResult,
  BdComment,
  // Mutation types
  MutationType,
  MutationEvent,
} from "./types.js"
