/**
 * Parse a task ID from the URL path or legacy hash.
 */
export function parseTaskIdFromUrl(
  /** URL parts to parse. */
  url: { pathname: string; hash: string },
): string | null {
  const pathMatch = url.pathname.match(/^\/issue\/([a-z0-9-]+(?:\.\d+)?)$/i)
  if (pathMatch) {
    const id = pathMatch[1]
    if (id && /^[a-z]+-[a-z0-9]+(\.\d+)?$/i.test(id)) {
      return id
    }
  }

  const hash = url.hash
  if (hash && hash !== "#") {
    const hashContent = hash.startsWith("#") ? hash.slice(1) : hash
    if (hashContent.startsWith("id=")) {
      const id = hashContent.slice("id=".length)
      if (id && /^[a-z]+-[a-z0-9]+(\.\d+)?$/i.test(id)) {
        return id
      }
    }
  }

  return null
}
