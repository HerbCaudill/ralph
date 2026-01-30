import { useEffect, useState, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { highlight, normalizeLanguage } from "@/lib/theme/highlighter"
import { useTheme } from "@/hooks/useTheme"
import { IconCopy, IconCheck } from "@tabler/icons-react"

export interface CodeBlockProps {
  /** The code to highlight */
  code: string
  /** The language for syntax highlighting */
  language?: string
  /** Whether to show line numbers */
  showLineNumbers?: boolean
  /** Whether to use dark theme (when no VS Code theme is active) */
  isDark?: boolean
  /** Whether to show the copy button */
  showCopy?: boolean
  /** Additional class names */
  className?: string
}

/**  Syntax-highlighted code block with optional copy button. */
export function CodeBlock({
  /** The code to highlight */
  code,
  /** The language for syntax highlighting (default: "text") */
  language = "text",
  /** Reserved for future use (default: false) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showLineNumbers: _showLineNumbers = false,
  /** Whether to use dark theme (auto-detected from app theme if not provided) */
  isDark,
  /** Whether to show the copy button (default: true) */
  showCopy = true,
  /** Additional class names */
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const { resolvedTheme } = useTheme()

  // Use provided isDark prop or auto-detect from resolved theme
  const effectiveIsDark = isDark ?? resolvedTheme === "dark"

  // Normalize language using the centralized function
  const normalizedLang = useMemo(() => normalizeLanguage(language), [language])

  useEffect(() => {
    let cancelled = false

    async function doHighlight() {
      try {
        // Use the centralized highlight function which supports VS Code themes
        // The highlighter validates that the custom theme type matches the requested mode
        const result = await highlight(code, normalizedLang, { isDark: effectiveIsDark })

        if (!cancelled) {
          setHtml(result)
          setIsLoading(false)
        }
      } catch {
        // Fallback to plain text on error
        if (!cancelled) {
          setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`)
          setIsLoading(false)
        }
      }
    }

    doHighlight()

    return () => {
      cancelled = true
    }
  }, [code, normalizedLang, effectiveIsDark])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available, ignore
    }
  }, [code])

  // Container styles that apply to both loading and highlighted states
  // This ensures no layout shift occurs when highlighting completes
  // Force child pre to be transparent so container bg-muted shows through
  const containerStyles = cn(
    "group relative overflow-hidden rounded-md bg-muted/50",
    "[&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:overflow-x-auto [&_pre]:!p-3 [&_pre]:text-xs [&_code]:text-xs",
    className,
  )

  return (
    <div className={containerStyles}>
      {isLoading ?
        <pre className="m-0 overflow-x-auto p-3 text-xs">
          <code className="text-xs">{code}</code>
        </pre>
      : <div dangerouslySetInnerHTML={{ __html: html }} />}
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 rounded-md p-1.5 transition-opacity",
            "bg-background/80 hover:bg-muted border-border/50 border",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none",
          )}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ?
            <IconCheck className="text-status-success h-4 w-4" />
          : <IconCopy className="text-muted-foreground h-4 w-4" />}
        </button>
      )}
    </div>
  )
}

/**  Escape HTML special characters to prevent XSS. */
function escapeHtml(
  /** The text to escape */
  text: string,
): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
