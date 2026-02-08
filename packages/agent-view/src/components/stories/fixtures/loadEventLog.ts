import type { ChatEvent } from "../../../types"

/**
 * Parses a JSONL (JSON Lines) string into an array of ChatEvent objects.
 * Filters out stream_event types as they are intermediate streaming events
 * not intended for final display.
 */
export function parseEventLog(jsonl: string): ChatEvent[] {
  return jsonl
    .split("\n")
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line) as ChatEvent
      } catch {
        console.warn("Failed to parse event log line:", line)
        return null
      }
    })
    .filter((event): event is ChatEvent => event !== null)
    .filter(event => event.type !== "stream_event")
}

// Import raw JSONL fixtures using Vite's ?raw suffix
import sessionWithToolsRaw from "./session-with-tools.jsonl?raw"
import sessionLocAnalysisRaw from "./session-loc-analysis.jsonl?raw"
import sessionWithRalphEventsRaw from "./session-with-ralph-events.jsonl?raw"

/** Events from a session running tests and displaying results */
export const sessionWithToolsEvents = parseEventLog(sessionWithToolsRaw)

/** Events from a session analyzing lines of code in the repository */
export const sessionLocAnalysisEvents = parseEventLog(sessionLocAnalysisRaw)

/** Events from a Ralph session working on a task */
export const sessionWithRalphEvents = parseEventLog(sessionWithRalphEventsRaw)
