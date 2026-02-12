import { useEffect, useState, useMemo, useCallback } from "react"
import { cn } from "../lib/cn"
import { highlight, normalizeLanguage } from "@herbcaudill/agent-view-theme"
import { IconCopy, IconCheck } from "@tabler/icons-react"
import { Button } from "./button"

export interface CodeBlockProps {
  /** The code to highlight */
  code: string
  /** The language for syntax highlighting */
  language?: string
  /** Whether to show line numbers */
  showLineNumbers?: boolean
  /** Whether to use dark theme */
  isDark?: boolean
  /** Whether to show the copy button */
  showCopy?: boolean
  /** Additional class names */
  className?: string
}

/** Syntax-highlighted code block with optional copy button. */
export function CodeBlock({
  /** The code to highlight */
  code,
  /** The language for syntax highlighting (default: "text") */
  language = "text",
  /** Reserved for future use (default: false) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showLineNumbers: _showLineNumbers = false,
  /** Whether to use dark theme (default: false) */
  isDark = false,
  /** Whether to show the copy button (default: true) */
  showCopy = true,
  /** Additional class names */
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Normalize language using the centralized function
  const normalizedLang = useMemo(() => normalizeLanguage(language), [language])

  useEffect(() => {
    let cancelled = false

    async function doHighlight() {
      try {
        const result = await highlight(code, normalizedLang, { isDark })

        if (!cancelled) {
          setHtml(result)
          setIsLoading(false)
        }
      } catch {
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
  }, [code, normalizedLang, isDark])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available, ignore
    }
  }, [code])

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
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 transition-opacity",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ?
            <IconCheck className="text-status-success" />
          : <IconCopy className="text-muted-foreground" />}
        </Button>
      )}
    </div>
  )
}

/** Escape HTML special characters to prevent XSS. */
function escapeHtml(
  /** The text to escape */
  text: string,
): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
