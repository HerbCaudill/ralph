/**
 * Parse the URL to extract session ID.
 * Supports format: /session/{id}
 *
 * Session IDs are alphanumeric with dashes (e.g., "default-1706123456789").
 * For backward compatibility, also supports legacy hash formats:
 * - #session={id}
 * - #eventlog={8-char-hex}
 */
export function parseSessionIdFromUrl(url: { pathname: string; hash: string }): string | null {
  // Check path-based format first: /session/{id}
  const pathMatch = url.pathname.match(/^\/session\/([a-zA-Z0-9-]+)$/)
  if (pathMatch) {
    const id = pathMatch[1]
    if (id) {
      return id
    }
  }

  // Backward compatibility: support legacy hash formats
  const hash = url.hash
  if (hash && hash !== "#") {
    const hashContent = hash.startsWith("#") ? hash.slice(1) : hash

    // Check for session= prefix
    if (hashContent.startsWith("session=")) {
      const id = hashContent.slice("session=".length)
      if (id && /^[a-zA-Z0-9-]+$/.test(id)) {
        return id
      }
    }

    // Check for legacy eventlog= prefix
    if (hashContent.startsWith("eventlog=")) {
      const id = hashContent.slice("eventlog=".length)
      if (id && /^[a-f0-9]{8}$/i.test(id)) {
        return id
      }
    }
  }

  return null
}

/**  Build a URL path for a session ID. */
export function buildSessionPath(id: string): string {
  return `/session/${id}`
}

// Legacy exports for backwards compatibility with tests
export const parseEventLogHash = (hash: string): string | null => {
  return parseSessionIdFromUrl({ pathname: "/", hash })
}

export const buildEventLogHash = (id: string): string => {
  return `#session=${id}`
}
