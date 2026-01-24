import { type ContentBlock } from "./eventToBlocks.js"
import { type MutationEvent } from "../lib/beadsClient.js"

/**  Iteration events collection for a given iteration number. */
export type IterationEvents = {
  iteration: number
  events: Array<Record<string, unknown>>
}

/**  Static item representing either header, iteration header, or content block. */
export type StaticItem =
  | { type: "header"; claudeVersion: string; ralphVersion: string; key: string }
  | { type: "iteration"; iteration: number; key: string }
  | { type: "block"; block: ContentBlock; key: string }

/**  Props for the IterationRunner component. */
export type IterationRunnerProps = {
  totalIterations: number
  claudeVersion: string
  ralphVersion: string
  watch?: boolean
  agent: string
}
