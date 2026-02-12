import type { ReactNode, MouseEvent } from "react"
import { cn } from "../lib/cn"

/**
 * Regex pattern that matches session references.
 * Matches patterns like: /session/default-1706123456789 (alphanumeric with dashes)
 * For backward compatibility, also matches legacy hash formats:
 * - #session=default-1706123456789
 * - #eventlog=abcdef12
 */
const SESSION_PATH_PATTERN = /\/session\/([a-zA-Z0-9-]+)(?![a-zA-Z0-9-])/gi
const SESSION_HASH_PATTERN = /#session=([a-zA-Z0-9-]+)(?![a-zA-Z0-9-])/gi
const LEGACY_EVENTLOG_PATTERN = /#eventlog=([a-f0-9]{8})(?![a-f0-9])/gi

/**
 * Creates a regex pattern that matches task IDs with the given prefix.
 * If no prefix is provided, returns null (don't match anything).
 */
function createTaskIdPattern(
  /** The issue prefix for the workspace (e.g., "rui") */
  prefix: string | null,
): RegExp | null {
  if (!prefix) return null
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match prefix-alphanumeric with optional decimal suffixes (e.g., rui-4vp.1 or rui-4vp.1.2.3)
  return new RegExp(`\\b(${escapedPrefix}-[a-z0-9]+(?:\\.\\d+)*)\\b`, "g")
}

/**
 * Strip the issue prefix from a task ID for display.
 *
 * Given a task ID like "rui-4vp" and a prefix like "rui",
 * returns just "4vp".
 */
function stripTaskPrefix(
  /** The full task ID (e.g., "rui-4vp" or "rui-4vp.5") */
  taskId: string,
  /** The issue prefix for this workspace (e.g., "rui") */
  prefix: string | null,
): string {
  if (!prefix) return taskId
  const expectedPrefix = `${prefix}-`
  if (taskId.startsWith(expectedPrefix)) {
    return taskId.slice(expectedPrefix.length)
  }
  return taskId
}

interface TextSegment {
  type: "text" | "taskId" | "session"
  content: string
  id?: string
  startIndex: number
}

/**
 * Parse text and extract task ID and session references.
 * Returns segments in order of appearance.
 */
function parseTextSegments(
  /** The text content to parse */
  text: string,
  /** Prefix used to match task IDs */
  taskIdPrefix: string | null,
): TextSegment[] {
  const segments: TextSegment[] = []

  // Find all task ID matches
  const taskIdPattern = createTaskIdPattern(taskIdPrefix)
  const taskMatches: { match: RegExpExecArray; type: "taskId" }[] = []
  if (taskIdPattern) {
    taskIdPattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = taskIdPattern.exec(text)) !== null) {
      taskMatches.push({ match, type: "taskId" })
    }
  }

  // Find all session matches
  const sessionMatches: { match: RegExpExecArray; type: "session" }[] = []
  let match: RegExpExecArray | null

  // Find new /session/{id} path format matches
  SESSION_PATH_PATTERN.lastIndex = 0
  while ((match = SESSION_PATH_PATTERN.exec(text)) !== null) {
    sessionMatches.push({ match, type: "session" })
  }

  // Find legacy #session= hash format matches
  SESSION_HASH_PATTERN.lastIndex = 0
  while ((match = SESSION_HASH_PATTERN.exec(text)) !== null) {
    sessionMatches.push({ match, type: "session" })
  }

  // Find legacy #eventlog= format matches
  LEGACY_EVENTLOG_PATTERN.lastIndex = 0
  while ((match = LEGACY_EVENTLOG_PATTERN.exec(text)) !== null) {
    sessionMatches.push({ match, type: "session" })
  }

  // Combine and sort all matches by position
  const allMatches = [...taskMatches, ...sessionMatches].sort(
    (a, b) => a.match.index - b.match.index,
  )

  let lastIndex = 0
  for (const { match, type } of allMatches) {
    // Skip if this match overlaps with the previous one
    if (match.index < lastIndex) continue

    // Add text segment before this match
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
        startIndex: lastIndex,
      })
    }

    // Add the matched segment
    if (type === "taskId") {
      segments.push({
        type: "taskId",
        content: match[0],
        id: match[1],
        startIndex: match.index,
      })
    } else {
      segments.push({
        type: "session",
        content: match[0],
        id: match[1],
        startIndex: match.index,
      })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
      startIndex: lastIndex,
    })
  }

  return segments
}

/**
 * Renders text with task IDs and session references converted to clickable links.
 * When no linkHandlers are provided, renders text as-is without linkification.
 */
export function TextWithLinks({ children, className, linkHandlers }: TextWithLinksProps) {
  const issuePrefix = linkHandlers?.taskIdPrefix ?? null

  // Handle undefined/empty children
  if (!children) {
    return null
  }

  // If no linkHandlers provided, just render the text as-is
  if (!linkHandlers) {
    return <>{children}</>
  }

  // Use accent color for links, with hover underline
  const linkClassName = cn("cursor-pointer hover:underline text-link", className)

  const segments = parseTextSegments(children, issuePrefix)

  // If no segments or only one text segment, return the original text
  if (segments.length === 0 || (segments.length === 1 && segments[0].type === "text")) {
    return <>{children}</>
  }

  const parts: ReactNode[] = segments.map((segment, index) => {
    if (segment.type === "text") {
      return segment.content
    }

    if (segment.type === "taskId") {
      const taskId = segment.id!
      const displayId = stripTaskPrefix(taskId, issuePrefix)
      const taskHref = linkHandlers.buildTaskHref?.(taskId)

      if (!taskHref && !linkHandlers.onTaskClick) {
        return <span key={`taskId-${index}`}>{displayId}</span>
      }

      const handleClick = (e: MouseEvent) => {
        if (!linkHandlers.onTaskClick) return
        e.preventDefault()
        e.stopPropagation()
        linkHandlers.onTaskClick(taskId)
      }

      return (
        <a
          key={`taskId-${index}`}
          href={taskHref}
          className={linkClassName}
          onClick={linkHandlers.onTaskClick ? handleClick : undefined}
          aria-label={`View task ${taskId}`}
        >
          {displayId}
        </a>
      )
    }

    const sessionId = segment.id!
    const sessionHref = linkHandlers.buildSessionHref?.(sessionId)

    if (!sessionHref && !linkHandlers.onSessionClick) {
      return <span key={`session-${index}`}>{segment.content}</span>
    }

    const handleClick = (e: MouseEvent) => {
      if (!linkHandlers.onSessionClick) return
      e.preventDefault()
      e.stopPropagation()
      linkHandlers.onSessionClick(sessionId)
    }

    return (
      <a
        key={`session-${index}`}
        href={sessionHref}
        className={linkClassName}
        onClick={linkHandlers.onSessionClick ? handleClick : undefined}
        aria-label={`View session ${sessionId}`}
      >
        {segment.content}
      </a>
    )
  })

  return <>{parts}</>
}

/** Link handler configuration for task ID and session reference linkification. */
export interface TextWithLinksLinkHandlers {
  /** Prefix used to identify task IDs (e.g., "rui") */
  taskIdPrefix?: string | null
  /** Callback when a task link is clicked */
  onTaskClick?: (taskId: string) => void
  /** Callback when a session link is clicked */
  onSessionClick?: (sessionId: string) => void
  /** Build an href for a task link */
  buildTaskHref?: (taskId: string) => string
  /** Build an href for a session link */
  buildSessionHref?: (sessionId: string) => string
}

export interface TextWithLinksProps {
  /** Text content that may contain task IDs and session references */
  children: string
  /** Additional class name for links */
  className?: string
  /** Optional link handlers for task ID and session reference linkification */
  linkHandlers?: TextWithLinksLinkHandlers
}
