import { useEffect, useState } from "react"
import { highlight } from "@/lib/theme/highlighter"
import { useTheme } from "@/hooks/useTheme"

/**
 * Hook to syntax-highlight code content using the current theme.
 * Returns the highlighted HTML string ready for rendering.
 *
 * The highlighter automatically uses VS Code custom themes when loaded,
 * but validates that the theme type matches the requested mode.
 */
export function useHighlightedCode(
  /** The code content to highlight */
  content: string,
  /** The programming language for syntax highlighting */
  language: string,
): string {
  const [html, setHtml] = useState<string>("")
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  useEffect(() => {
    let cancelled = false

    async function doHighlight() {
      try {
        // Let the highlighter decide which theme to use based on isDark
        // It will use the custom VS Code theme if loaded and type matches,
        // otherwise falls back to default themes
        const result = await highlight(content, language, { isDark })
        if (!cancelled) {
          const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/)
          setHtml(match ? match[1] : content)
        }
      } catch {
        if (!cancelled) {
          setHtml("")
        }
      }
    }

    doHighlight()

    return () => {
      cancelled = true
    }
  }, [content, language, isDark])

  return html
}
