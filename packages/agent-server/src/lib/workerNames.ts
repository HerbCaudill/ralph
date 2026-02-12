/**
 * Worker names for concurrent Ralph workers.
 *
 * TODO: This is a temporary copy. The canonical source is in
 * @herbcaudill/ralph-ui (server/lib/workerNames.ts). Remove this file
 * when WorkerOrchestrator moves to ralph-ui.
 */
export const WORKER_NAMES = [
  "homer",
  "marge",
  "bart",
  "lisa",
  "maggie",
  "grampa",
  "patty",
  "selma",
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

/** Type representing a valid worker name. */
export type WorkerName = (typeof WORKER_NAMES)[number]

/** Get a worker name by index. Wraps around if index exceeds the array length. */
export function getWorkerName(
  /** The worker index (0-based) */
  index: number,
): WorkerName {
  const len = WORKER_NAMES.length
  const normalizedIndex = ((index % len) + len) % len
  return WORKER_NAMES[normalizedIndex]
}

/** Check if a string is a valid worker name. */
export function isValidWorkerName(
  /** The name to check */
  name: string,
): name is WorkerName {
  return WORKER_NAMES.includes(name as WorkerName)
}
