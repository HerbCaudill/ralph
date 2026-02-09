import type { ChatEvent } from "../../../types"

// Import JSON fixtures
import sessionWithToolsData from "./session-with-tools.json"
import sessionLocAnalysisData from "./session-loc-analysis.json"
import sessionWithRalphEventsData from "./session-with-ralph-events.json"

/** Events from a session running tests and displaying results */
export const sessionWithToolsEvents = sessionWithToolsData as ChatEvent[]

/** Events from a session analyzing lines of code in the repository */
export const sessionLocAnalysisEvents = sessionLocAnalysisData as ChatEvent[]

/** Events from a Ralph session working on a task */
export const sessionWithRalphEvents = sessionWithRalphEventsData as ChatEvent[]
