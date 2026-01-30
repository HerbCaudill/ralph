import { cn } from "../../lib/utils"
import { useHighlightedCode } from "../../hooks/useHighlightedCode"

/**
 * Renders a single line of code with syntax highlighting based on the current theme.
 * Uses the custom VS Code theme if configured, otherwise falls back to default themes.
 */
export function HighlightedLine({ content, language, className }: Props) {
  const html = useHighlightedCode(content, language)

  if (!html) {
    return <span className={cn("whitespace-pre", className)}>{content}</span>
  }

  return (
    <span className={cn("whitespace-pre", className)} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

type Props = {
  content: string
  language: string
  className?: string
}
