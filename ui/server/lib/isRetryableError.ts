/**  Check if an error is retryable (network/connection errors, rate limits, server errors). */
export function isRetryableError(
  /** The error to check */
  error: Error,
): boolean {
  const message = error.message.toLowerCase()

  // Connection/network errors
  if (
    message.includes("connection error") ||
    message.includes("network error") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    message.includes("failed to fetch") ||
    message.includes("getaddrinfo") ||
    message.includes("enotfound")
  ) {
    return true
  }

  // Rate limit errors
  if (message.includes("rate limit") || message.includes("rate_limit") || message.includes("429")) {
    return true
  }

  // Server errors (5xx)
  if (
    message.includes("server error") ||
    message.includes("server_error") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true
  }

  // Overloaded error
  if (message.includes("overloaded")) {
    return true
  }

  return false
}
