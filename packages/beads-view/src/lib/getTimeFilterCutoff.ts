import type { ClosedTasksTimeFilter } from "../types"

/** Get the cutoff timestamp for a time filter. */
export function getTimeFilterCutoff(
  /** Filter value to evaluate. */
  filter: ClosedTasksTimeFilter,
): Date | null {
  if (filter === "all_time") return null
  const now = new Date()
  switch (filter) {
    case "past_hour":
      return new Date(now.getTime() - 60 * 60 * 1000)
    case "past_4_hours":
      return new Date(now.getTime() - 4 * 60 * 60 * 1000)
    case "past_day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case "past_week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
}
