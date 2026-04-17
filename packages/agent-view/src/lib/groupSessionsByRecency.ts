/** A group of sessions sharing a recency label. */
export type SessionGroup<T> = {
  /** The display label for this group (e.g. "Today", "Yesterday"). */
  label: string
  /** The sessions in this group, in their original order. */
  sessions: T[]
}

/**
 * Groups sessions by recency into "Today", "Yesterday", "Past week", and "Older" buckets.
 * Only returns groups that contain at least one session. Preserves the original
 * order of sessions within each group.
 */
export function groupSessionsByRecency<T extends { lastMessageAt: number }>(
  /** The sessions to group, typically sorted by recency (most recent first). */
  sessions: T[],
): SessionGroup<T>[] {
  if (sessions.length === 0) return []

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000

  const buckets: { label: string; sessions: T[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Past week", sessions: [] },
    { label: "Older", sessions: [] },
  ]

  for (const session of sessions) {
    const t = session.lastMessageAt
    if (t >= todayStart) {
      buckets[0].sessions.push(session)
    } else if (t >= yesterdayStart) {
      buckets[1].sessions.push(session)
    } else if (t >= weekStart) {
      buckets[2].sessions.push(session)
    } else {
      buckets[3].sessions.push(session)
    }
  }

  return buckets.filter(b => b.sessions.length > 0)
}
