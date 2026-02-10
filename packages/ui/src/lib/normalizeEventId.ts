import type { ChatEvent } from "@herbcaudill/agent-view"

/**
 * Normalize an event's id field.
 * Events from the Claude CLI have a `uuid` field but our deduplication uses `id`.
 * This function ensures `id` is set, falling back to `uuid` if present.
 */
export function normalizeEventId(event: ChatEvent): ChatEvent {
  // If id is already set, nothing to do
  if (event.id) return event

  // Check for uuid field (from Claude CLI events)
  const uuid = (event as Record<string, unknown>).uuid as string | undefined
  if (uuid) {
    return { ...event, id: uuid }
  }

  return event
}
