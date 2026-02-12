import type { ChatEvent } from "@herbcaudill/agent-view"
import { extractTaskLifecycleEvent } from "./extractTaskLifecycleEvent"

/** localStorage key for the session-to-taskId mapping. */
export const STORAGE_KEY = "ralph:sessionTaskIds"

/**
 * Extract the first task ID from a list of chat events.
 * Iterates events and uses extractTaskLifecycleEvent to find the first start_task marker.
 */
export function extractTaskIdFromEvents(
  /** The chat events to search through. */
  events: ChatEvent[],
): string | undefined {
  for (const event of events) {
    const lifecycle = extractTaskLifecycleEvent(event)
    if (lifecycle?.action === "starting") {
      return lifecycle.taskId
    }
  }
  return undefined
}

/**
 * Read the cached task ID for a session from localStorage.
 * Returns undefined if not found or if localStorage is corrupted.
 */
export function getSessionTaskId(
  /** The session ID to look up. */
  sessionId: string,
): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const cache = JSON.parse(raw) as Record<string, string>
    return cache[sessionId]
  } catch {
    return undefined
  }
}

/**
 * Write a task ID for a session to the localStorage cache.
 * Preserves existing entries and handles corrupted state gracefully.
 */
export function setSessionTaskId(
  /** The session ID to cache. */
  sessionId: string,
  /** The task ID to associate with this session. */
  taskId: string,
): void {
  let cache: Record<string, string> = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cache = JSON.parse(raw) as Record<string, string>
    }
  } catch {
    // Start fresh if corrupted
  }
  cache[sessionId] = taskId
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
}
