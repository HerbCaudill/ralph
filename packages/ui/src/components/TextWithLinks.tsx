import { Fragment, useCallback, useMemo } from "react"

/** Pattern matching beads task IDs like "rui-123", "r-abc12", etc. */
const TASK_ID_PATTERN = /\b([a-z]+-[a-z0-9]+)\b/gi

/**
 * Renders text with auto-linked task IDs.
 * Task IDs matching the pattern (e.g., rui-123) become clickable links.
 */
export function TextWithLinks({ text, onTaskClick, className }: Props) {
  const handleClick = useCallback(
    (taskId: string) => (e: React.MouseEvent) => {
      e.preventDefault()
      onTaskClick?.(taskId)
    },
    [onTaskClick],
  )

  const parts = useMemo(() => {
    const result: Array<{ type: "text" | "link"; value: string }> = []
    let lastIndex = 0

    // Reset pattern state
    TASK_ID_PATTERN.lastIndex = 0

    let match
    while ((match = TASK_ID_PATTERN.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, match.index) })
      }
      // Add the matched task ID
      result.push({ type: "link", value: match[1] })
      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) })
    }

    return result
  }, [text])

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={`#task/${part.value}`}
            onClick={handleClick(part.value)}
            className="text-blue-500 hover:underline"
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </span>
  )
}

type Props = {
  /** The text to render with auto-linked task IDs. */
  text: string
  /** Callback when a task ID link is clicked. */
  onTaskClick?: (taskId: string) => void
  /** Optional CSS class. */
  className?: string
}
