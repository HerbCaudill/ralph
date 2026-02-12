import { useMemo } from "react"
import type { ChatEvent, UserMessageChatEvent } from "@herbcaudill/agent-view"

/**
 * Regular expression to match the worker name header in Ralph session prompts.
 * Matches patterns like "# Homer, round 3" or "# Ralph, round 6"
 */
const WORKER_NAME_PATTERN = /^#\s*([A-Za-z]+),\s*round\s+\d+/m

/**
 * Extract the active worker name from Ralph events.
 *
 * The worker name is embedded in the session prompt header that starts each Ralph session.
 * Format: "# {WorkerName}, round N"
 *
 * @param events - Array of chat events from the Ralph session
 * @returns The worker name if found, null otherwise
 */
export function useWorkerName(events: ChatEvent[]): string | null {
  return useMemo(() => {
    // Find the first user_message event that contains the worker name pattern
    for (const event of events) {
      if (event.type === "user_message") {
        const userMessage = event as UserMessageChatEvent
        const match = userMessage.message?.match(WORKER_NAME_PATTERN)
        if (match) {
          return match[1]
        }
      }
    }
    return null
  }, [events])
}
