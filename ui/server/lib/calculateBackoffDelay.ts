/**
 * Calculate delay for exponential backoff with jitter.
 */
export function calculateBackoffDelay(
  /** Current retry attempt number (0-based) */
  attempt: number,
  /** Initial delay in milliseconds */
  initialDelayMs: number,
  /** Maximum delay in milliseconds */
  maxDelayMs: number,
  /** Backoff multiplier for exponential growth */
  multiplier: number,
): number {
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt)
  const clampedDelay = Math.min(exponentialDelay, maxDelayMs)
  // Add jitter (±10%) to prevent thundering herd
  const jitter = clampedDelay * 0.1 * (Math.random() * 2 - 1)
  return Math.round(clampedDelay + jitter)
}
