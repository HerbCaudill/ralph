import type { ChatEvent } from "@herbcaudill/agent-view"

/** Response from GET /api/sessions/:id/events. */
interface EventsResponse {
  events?: ChatEvent[]
}

/** Options for fetchSessionEvents. */
export interface FetchSessionEventsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
}

/**
 * Fetch events for a session from the agent server.
 * Returns an empty array if the fetch fails or the session has no events.
 */
export async function fetchSessionEvents(
  /** The session ID to fetch events for. */
  sessionId: string,
  /** Options for the fetch operation. */
  options: FetchSessionEventsOptions = {},
): Promise<ChatEvent[]> {
  const { baseUrl = "", fetchFn = fetch } = options

  try {
    const response = await fetchFn(`${baseUrl}/api/sessions/${sessionId}/events`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as EventsResponse
    return data.events ?? []
  } catch {
    return []
  }
}
