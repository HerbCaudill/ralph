import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { highlight, getCurrentCustomThemeName } from "@/lib/theme/highlighter"
import { useTheme } from "@/hooks/useTheme"

export function HighlightedLine({ content, language, className }: Props) {
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
