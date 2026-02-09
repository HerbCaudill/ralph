/**
 * Build a WebSocket URL from an API client's base URL.
 *
 * Converts HTTP protocols to WebSocket protocols:
 * - http:// -> ws://
 * - https:// -> wss://
 *
 * For relative URLs (empty string, undefined, or path-only), returns the path suffix
 * (defaulting to "/ws").
 *
 * @param baseUrl - The API client's base URL (e.g., "http://localhost:3000", "", undefined)
 * @param pathSuffix - Optional path to append to the URL (defaults to "/ws")
 * @returns A WebSocket URL string
 *
 * @example
 * buildWsUrl("http://localhost:3000") // "ws://localhost:3000"
 * buildWsUrl("https://example.com") // "wss://example.com"
 * buildWsUrl("http://localhost:3000", "/events") // "ws://localhost:3000/events"
 * buildWsUrl("") // "/ws"
 * buildWsUrl(undefined) // "/ws"
 */
export function buildWsUrl(baseUrl: string | undefined, pathSuffix = "/ws"): string {
  // Normalize path suffix to always start with /
  const normalizedSuffix = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`

  // Handle relative URLs (empty, undefined, or path-only)
  if (!baseUrl || !baseUrl.includes("://")) {
    return normalizedSuffix
  }

  // Convert HTTP(S) to WS(S)
  const wsUrl = baseUrl.replace(/^https?:/i, match => {
    return match.toLowerCase() === "https:" ? "wss:" : "ws:"
  })

  // Append path suffix if provided (and not the default /ws which might not be needed)
  if (pathSuffix !== "/ws") {
    return wsUrl + normalizedSuffix
  }

  return wsUrl
}
