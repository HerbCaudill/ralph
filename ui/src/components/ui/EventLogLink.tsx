import type { ReactNode, MouseEvent } from "react"

/**
 * Regex pattern that matches eventlog references.
 * Matches patterns like: #eventlog=abcdef12 (exactly 8 character hex ID)
 * Uses negative lookahead to ensure the ID doesn't continue with more hex chars.
 */
const EVENTLOG_PATTERN = /#eventlog=([a-f0-9]{8})(?![a-f0-9])/gi

// Types

export interface EventLogLinkProps {
  /** Text content that may contain eventlog references */
  children: string
  /** Additional class name for eventlog links */
  className?: string
}

// EventLogLink Component

/**
 * Renders text with eventlog references converted to clickable links.
 * References matching the pattern #eventlog={8-char-hex} become links that
 * navigate to view the event log when clicked.
 */
export function EventLogLink({ children, className }: EventLogLinkProps) {
  // Parse the text and replace eventlog references with links
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset the regex state
  EVENTLOG_PATTERN.lastIndex = 0

  while ((match = EVENTLOG_PATTERN.exec(children)) !== null) {
    const eventLogId = match[1]
    const fullMatch = match[0]
    const startIndex = match.index

    // Add text before the match
    if (startIndex > lastIndex) {
      parts.push(children.slice(lastIndex, startIndex))
    }

    // Add the clickable eventlog link
    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Navigate using hash - the useEventLogRouter hook will handle the rest
      window.location.hash = `eventlog=${eventLogId}`
    }

    parts.push(
      <button
        key={`${eventLogId}-${startIndex}`}
        onClick={handleClick}
        className={
          className ??
          "cursor-pointer text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        }
        type="button"
        aria-label={`View event log ${eventLogId}`}
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
 * Utility function to check if a string contains any eventlog references.
 *
 * @param text - The text to check
 * @returns true if the text contains eventlog references
 */
export function containsEventLogRef(text: string): boolean {
  EVENTLOG_PATTERN.lastIndex = 0
  return EVENTLOG_PATTERN.test(text)
}
