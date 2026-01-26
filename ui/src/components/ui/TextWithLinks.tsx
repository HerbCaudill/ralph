import type { ReactNode, MouseEvent } from "react"
import { useAppStore, selectIssuePrefix } from "@/store"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"

/**
 * Regex pattern that matches session references.
 * Matches patterns like: #session=default-1706123456789 (alphanumeric with dashes)
 * For backward compatibility, also matches legacy #eventlog=abcdef12 format.
 */
const SESSION_PATTERN = /#session=([a-zA-Z0-9-]+)(?![a-zA-Z0-9-])/gi
const LEGACY_EVENTLOG_PATTERN = /#eventlog=([a-f0-9]{8})(?![a-f0-9])/gi

/**
 * Creates a regex pattern that matches task IDs with the given prefix.
 * If no prefix is provided, returns null (don't match anything).
 *
 * @param prefix - The issue prefix for this workspace (e.g., "rui")
 * @returns A regex that matches task IDs like "rui-48s" or "rui-4vp.5", or null if no prefix
 */
function createTaskIdPattern(prefix: string | null): RegExp | null {
  if (!prefix) return null
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match prefix-alphanumeric with optional decimal suffixes (e.g., rui-4vp.1 or rui-4vp.1.2.3)
  return new RegExp(`\\b(${escapedPrefix}-[a-z0-9]+(?:\\.\\d+)*)\\b`, "g")
}

interface TextSegment {
  type: "text" | "taskId" | "session"
  content: string
  id?: string // The extracted ID (task ID or session ID)
  startIndex: number
}

/**
 * Parse text and extract task ID and session references.
 * Returns segments in order of appearance.
 * Supports both new #session= format and legacy #eventlog= format.
 */
function parseTextSegments(text: string, taskIdPrefix: string | null): TextSegment[] {
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

  // Find all session matches (new format)
  SESSION_PATTERN.lastIndex = 0
  const sessionMatches: { match: RegExpExecArray; type: "session" }[] = []
  let match: RegExpExecArray | null
  while ((match = SESSION_PATTERN.exec(text)) !== null) {
    sessionMatches.push({ match, type: "session" })
  }

  // Find all legacy event log matches
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

// Types

export interface TextWithLinksProps {
  /** Text content that may contain task IDs and session references */
  children: string
  /** Additional class name for links */
  className?: string
}

/**
 * Renders text with task IDs and session references converted to clickable links.
 *
 * - Task IDs matching the workspace prefix (e.g., rui-48s) open the task dialog
 * - Session references (#session=id or legacy #eventlog=abcdef12) navigate to view the session
 */
export function TextWithLinks({ children, className }: TextWithLinksProps) {
  const issuePrefix = useAppStore(selectIssuePrefix)
  // const accentColor = useAppStore(selectAccentColor)
  // const linkColor = accentColor ?? DEFAULT_ACCENT_COLOR

  // Handle undefined/empty children
  if (!children) {
    return null
  }

  // Use accent color for links, with hover underline
  const linkClassName = cn("cursor-pointer hover:underline text-link", className)
  // const linkStyle: CSSProperties = { color: linkColor }

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
      // Task ID link
      const taskId = segment.id!
      const displayId = stripTaskPrefix(taskId, issuePrefix)

      return (
        <a
          key={`taskId-${index}`}
          href={buildTaskIdPath(taskId)}
          className={linkClassName}
          // style={linkStyle}
          aria-label={`View task ${taskId}`}
        >
          {displayId}
        </a>
      )
    }

    // Session link
    const sessionId = segment.id!

    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Navigate using new session= hash format
      window.location.hash = `session=${sessionId}`
    }

    return (
      <button
        key={`session-${index}`}
        onClick={handleClick}
        className={linkClassName}
        type="button"
        aria-label={`View session ${sessionId}`}
      >
        {segment.content}
      </button>
    )
  })

  return <>{parts}</>
}
