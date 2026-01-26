import type { ReactNode, MouseEvent } from "react"

/**
 * Regex pattern that matches session references.
 * Matches patterns like: #session=default-1706123456789 (alphanumeric with dashes)
 * For backward compatibility, also matches legacy #eventlog=abcdef12 format.
 */
const SESSION_PATTERN = /#session=([a-zA-Z0-9-]+)(?![a-zA-Z0-9-])/gi
const LEGACY_EVENTLOG_PATTERN = /#eventlog=([a-f0-9]{8})(?![a-f0-9])/gi

// Types

export interface EventLogLinkProps {
  /** Text content that may contain session references */
  children: string
  /** Additional class name for session links */
  className?: string
}

interface SessionMatch {
  id: string
  fullMatch: string
  startIndex: number
}

/**
 * Find all session reference matches in text, supporting both new #session= format
 * and legacy #eventlog= format.
 */
function findSessionMatches(text: string): SessionMatch[] {
  const matches: SessionMatch[] = []

  // Find new #session= format matches
  SESSION_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SESSION_PATTERN.exec(text)) !== null) {
    matches.push({
      id: match[1],
      fullMatch: match[0],
      startIndex: match.index,
    })
  }

  // Find legacy #eventlog= format matches
  LEGACY_EVENTLOG_PATTERN.lastIndex = 0
  while ((match = LEGACY_EVENTLOG_PATTERN.exec(text)) !== null) {
    matches.push({
      id: match[1],
      fullMatch: match[0],
      startIndex: match.index,
    })
  }

  // Sort by position
  return matches.sort((a, b) => a.startIndex - b.startIndex)
}

// EventLogLink Component

/**
 * Renders text with session references converted to clickable links.
 * References matching the pattern #session={id} or legacy #eventlog={8-char-hex}
 * become links that navigate to view the session when clicked.
 */
export function EventLogLink({ children, className }: EventLogLinkProps) {
  // Parse the text and replace session references with links
  const parts: ReactNode[] = []
  let lastIndex = 0

  const matches = findSessionMatches(children)

  for (const { id, fullMatch, startIndex } of matches) {
    // Skip overlapping matches
    if (startIndex < lastIndex) continue

    // Add text before the match
    if (startIndex > lastIndex) {
      parts.push(children.slice(lastIndex, startIndex))
    }

    // Add the clickable session link
    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Navigate using new session= hash format
      window.location.hash = `session=${id}`
    }

    parts.push(
      <button
        key={`${id}-${startIndex}`}
        onClick={handleClick}
        className={
          className ??
          "cursor-pointer text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        }
        type="button"
        aria-label={`View session ${id}`}
      >
        {fullMatch}
      </button>,
    )

    lastIndex = startIndex + fullMatch.length
  }

  // Add remaining text after the last match
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex))
  }

  // If no matches were found, return the original text
  if (parts.length === 0) {
    return <>{children}</>
  }

  return <>{parts}</>
}

/**
 * Utility function to check if a string contains any session references.
 * Checks for both new #session= format and legacy #eventlog= format.
 *
 * @param text - The text to check
 * @returns true if the text contains session references
 */
export function containsEventLogRef(text: string): boolean {
  SESSION_PATTERN.lastIndex = 0
  LEGACY_EVENTLOG_PATTERN.lastIndex = 0
  return SESSION_PATTERN.test(text) || LEGACY_EVENTLOG_PATTERN.test(text)
}
