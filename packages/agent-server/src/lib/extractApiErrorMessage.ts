/**
 * Extract a user-friendly error message from an API error.
 *
 * Claude API errors are often returned as JSON strings with nested structure like:
 * {"type":"error","error":{"type":"api_error","message":"Internal server error"},"request_id":"..."}
 *
 * This function parses such JSON errors and extracts the human-readable message.
 * For non-JSON errors, it returns the original message unchanged.
 */
export function extractApiErrorMessage(
  /** The raw error message (may be JSON or plain text) */
  message: string,
): string {
  if (!message || !message.trim()) {
    return message
  }

  // Only try to parse if it looks like JSON
  if (!message.startsWith("{")) {
    return message
  }

  try {
    const parsed = JSON.parse(message) as Record<string, unknown>

    // Check for Claude API error format: { error: { message: "..." } }
    if (
      typeof parsed.error === "object" &&
      parsed.error !== null &&
      "message" in parsed.error &&
      typeof (parsed.error as Record<string, unknown>).message === "string"
    ) {
      return (parsed.error as Record<string, unknown>).message as string
    }

    // Check for simple format: { message: "..." }
    if (typeof parsed.message === "string") {
      return parsed.message
    }

    // JSON but no extractable message, return original
    return message
  } catch {
    // Not valid JSON, return original
    return message
  }
}
