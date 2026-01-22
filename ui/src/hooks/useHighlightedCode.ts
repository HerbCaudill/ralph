import { useEffect, useState } from "react"
import { highlight, getCurrentCustomThemeName } from "@/lib/theme/highlighter"
import { useTheme } from "@/hooks/useTheme"

/**
 * Hook to syntax-highlight code content using the current theme.
 * Returns the highlighted HTML string ready for rendering.
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
        const themeName = getCurrentCustomThemeName()
        const result = await highlight(content, language, {
          theme: themeName ?? undefined,
          isDark,
        })
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
