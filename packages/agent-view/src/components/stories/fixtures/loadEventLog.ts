import type { ChatEvent } from "../../../types"

// Import JSON fixtures
import sessionWithToolsData from "./session-with-tools.json"
import sessionLocAnalysisData from "./session-loc-analysis.json"
import sessionWithRalphEventsData from "./session-with-ralph-events.json"

/** Filters out stream_event types as they are intermediate streaming events not intended for final display. */
function filterStreamEvents(events: ChatEvent[]): ChatEvent[] {
  return events.filter(event => event.type !== "stream_event")
}

/** Events from a session running tests and displaying results */
export const sessionWithToolsEvents = filterStreamEvents(sessionWithToolsData as ChatEvent[])

/** Events from a session analyzing lines of code in the repository */
export const sessionLocAnalysisEvents = filterStreamEvents(sessionLocAnalysisData as ChatEvent[])

/** Events from a Ralph session working on a task */
export const sessionWithRalphEvents = filterStreamEvents(sessionWithRalphEventsData as ChatEvent[])
