import type { AgentType } from "../hooks/useAgentChat"

const STORAGE_KEY = "agent-view-session-index"

/** A single entry in the session index. */
export type SessionIndexEntry = {
  sessionId: string
  adapter: AgentType
  firstMessageAt: number
  lastMessageAt: number
  firstUserMessage: string
}

/** Read all entries from localStorage, sorted by recency (most recent first). */
export function listSessions(): SessionIndexEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const entries = JSON.parse(raw) as SessionIndexEntry[]
    if (!Array.isArray(entries)) return []
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}

/** Get a single session entry by ID. */
export function getSession(sessionId: string): SessionIndexEntry | undefined {
  return listSessions().find(e => e.sessionId === sessionId)
}

/** Persist the given entries array to localStorage. */
function save(entries: SessionIndexEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Add a new session to the index.
 * If a session with the same ID already exists, it is replaced.
 */
export function addSession(entry: SessionIndexEntry): void {
  const entries = listSessions().filter(e => e.sessionId !== entry.sessionId)
  entries.push(entry)
  save(entries)
}

/**
 * Update an existing session entry (partial update).
 * Only the provided fields are merged; the rest are preserved.
 * If the session doesn't exist, this is a no-op.
 */
export function updateSession(
  sessionId: string,
  updates: Partial<Omit<SessionIndexEntry, "sessionId">>,
): void {
  const entries = listSessions()
  const index = entries.findIndex(e => e.sessionId === sessionId)
  if (index < 0) return
  entries[index] = { ...entries[index], ...updates }
  save(entries)
}

/**
 * Remove a session from the index by ID.
 */
export function removeSession(sessionId: string): void {
  const entries = listSessions().filter(e => e.sessionId !== sessionId)
  save(entries)
}

/**
 * Remove all sessions from the index.
 */
export function clearSessionIndex(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
