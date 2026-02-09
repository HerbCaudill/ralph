/**
 * Worker names for concurrent Ralph workers.
 *
 * Each worker uses its name for:
 * - Branch naming: ralph/<name>/<task-id>
 * - Task assignment: --assignee=<name>
 *
 * Names are Simpsons characters, starting with the main family
 * and extending to neighbors and friends.
 */
export const WORKER_NAMES = [
  // The Simpson family
  "homer",
  "marge",
  "bart",
  "lisa",
  "maggie",

  // Extended family
  "grampa",
  "patty",
  "selma",

  // Neighbors and friends
  "ned",
  "rod",
  "todd",
  "moe",
  "barney",
  "lenny",
  "carl",
  "milhouse",
  "nelson",
  "ralph",

  // Springfield residents
  "apu",
  "wiggum",
  "krusty",
  "sideshow",
  "smithers",
  "burns",
  "skinner",
  "edna",
  "otto",
  "groundskeeper",
  "comic",
  "hans",
] as const

/**
 * Type representing a valid worker name.
 */
export type WorkerName = (typeof WORKER_NAMES)[number]

/**
 * Get a worker name by index.
 * Wraps around if index exceeds the array length.
 *
 * @param index - The worker index (0-based)
 * @returns The worker name at that index (with wrapping)
 */
export function getWorkerName(index: number): WorkerName {
  // Handle negative indices by wrapping around
  const len = WORKER_NAMES.length
  const normalizedIndex = ((index % len) + len) % len
  return WORKER_NAMES[normalizedIndex]
}

/**
 * Check if a string is a valid worker name.
 *
 * @param name - The name to check
 * @returns True if the name is a valid WorkerName
 */
export function isValidWorkerName(name: string): name is WorkerName {
  return WORKER_NAMES.includes(name as WorkerName)
}
