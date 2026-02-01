import { parseTaskIdFromUrl } from "./parseTaskIdFromUrl"

/**
 * Parse a task ID from a legacy hash string.
 */
export function parseTaskIdHash(
  /** Hash string to parse. */
  hash: string,
): string | null {
  return parseTaskIdFromUrl({ pathname: "/", hash })
}
