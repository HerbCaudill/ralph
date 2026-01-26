import { type ContentBlock } from "./eventToBlocks.js"
import { type MutationEvent } from "../lib/beadsClient.js"

/**  Session events collection for a given session number. */
export type SessionEvents = {
  session: number
  events: Array<Record<string, unknown>>
}

/**  Static item representing either header, session header, or content block. */
export type StaticItem =
  | { type: "header"; claudeVersion: string; ralphVersion: string; key: string }
  | { type: "session"; session: number; key: string }
  | { type: "block"; block: ContentBlock; key: string }

/**  Props for the SessionRunner component. */
export type SessionRunnerProps = {
  totalSessions: number
  claudeVersion: string
  ralphVersion: string
  watch?: boolean
  agent: string
}
